/*
Copyright (C) 2012, 2013 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var url = require("url");
var sys = require("sys");
var fs = require("fs");
var path = require('path');
var express = require('express');
var config = require('./config.json');
var crypto = require('crypto'); // for getting hashes
var backendConfig = require('./Backends/backends.json');
var formatConfig = require('./Formats/formats.json');
var lib = require("./basic_lib");

/*  Rate Limiter */
var rate            = require('express-rate/lib/rate'),
  redis     = require('redis'),
  client      = redis.createClient();

var redisHandler = new rate.Redis.RedisRateHandler({client: client});
var commandMiddleware = rate.middleware({handler: redisHandler, interval: config.commandLimitingRate.interval, limit: config.commandLimitingRate.limit}); // limiting command sending
var pollingMiddleware = rate.middleware({handler: redisHandler, interval: config.pollingLimitingRate.interval, limit: config.pollingLimitingRate.limit}); // limiting polling
var fileMiddleware = rate.middleware({handler: redisHandler, interval: config.fileRequestLimitingRate.interval, limit: config.fileRequestLimitingRate.limit}); // limiting requesting files

/* ----- */

var port = config.port;

var server = express();

server.use(express.static(__dirname + '/Client'));
//server.use(express.static(__dirname + '/Client/'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));

var processes = []; // for storing sessions

//-------------------------------------------------
// Standard GET request
//-------------------------------------------------
// Response: File contents
server.get('/', fileMiddleware, function(req, res) {
    res.sendfile("Client/app.html");
});

//-------------------------------------------------
// File requests
//-------------------------------------------------

server.get('/Examples/:file', fileMiddleware, function(req, res) {
    res.sendfile('Examples/' + req.params.file);
});

server.get('/Backends/:file', fileMiddleware, function(req, res) {
    res.sendfile('Backends/' + req.params.file);
});

server.get('/Formats/:file', fileMiddleware, function(req, res) {
    res.sendfile('Formats/' + req.params.file);
});

server.get('/htmlwrapper', fileMiddleware, function(req, res) {
    res.sendfile("Client/compiler_html_wrapper.html");
});

//------------------- save format request --------------------------
server.get('/saveformat', fileMiddleware, function(req, res) {
    
    if (!req.query.windowKey)
        return;

    lib.logSpecific("Save format request", req.query.windowKey);

    var process = getProcess(req.query.windowKey);
    if (process == null)
    {
        res.writeHead(400, { "Content-Type": "text/html"});    
        res.end("process_not_found");        
        return;
    }

    var formatId = req.query.fileid;
    var found = false;
    var result = null;
    var suffix = "";
            // looking for a backend

    for (var j = 0; j < process.compiled_formats.length; j++)
    {
        if (process.compiled_formats[j].id == formatId)
        {
            found = true;
            result = process.compiled_formats[j].result;
            suffix = process.compiled_formats[j].fileSuffix;
            break;
        }
    }

    if (!found)
    {
        lib.logSpecific("Error: Format was not found within the process", req.query.windowKey);
        res.writeHead(400, { "Content-Type": "text/html"});    
        res.end("Error: Could not find the format within a process data by its submitted id: " + formatId);
        return;
    }
        
    res.writeHead(200, { "Content-Type": "text/html",
                                 "Content-Disposition": "attachment; filename=compiled" + suffix});
    res.end(result);
});

//-------------------------------------------------
//  Command Requests
//-------------------------------------------------

/* Controlling Instance Generators */
server.post('/control', commandMiddleware, function(req, res)
{
    lib.logSpecific("Control: Enter", req.body.windowKey);

    var isError = true;
    var resultMessage;

    var process = getProcess(req.body.windowKey);
    if (process == null)
    {
        res.writeHead(400, { "Content-Type": "text/html"});
        res.end("process_not_found");               
        return;
    }

    if (req.body.operation == "run") // "Run" operation
    {
        lib.logSpecific("Control: Run", req.body.windowKey);

        var backendId = req.body.backend;
        lib.logSpecific("Backend: " + backendId, req.body.windowKey);
        if (process.mode != "ig")
        {
            lib.logSpecific("Error: Not compiled yet", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: The mode is not IG: the compilation is still running");        
            return;
        }
        else
        {
            timeoutProcessClearInactivity(process); // reset the inactivity timeout

            // looking for a backend
            var backend = getBackend(backendId);
            if (!backend)
            {
                lib.logSpecific("Error: Backend was not found", req.body.windowKey);
                res.writeHead(400, { "Content-Type": "text/html"});
                res.end("Error: Could not find the backend by its submitted id.");
                return;
            }

            // looking for a format
            var format = getFormat(backend.accepted_format);
            if (!format)
            {
                lib.logSpecific("Error: Required format was not found", req.body.windowKey);
                resultMessage = "Error: Could not find the required file format.";
                isError = true;
                return;
            }

            lib.logSpecific(backend.id + " ==> " + format.id, req.body.windowKey);
            process.mode_completed = false;

            var fileAndPathReplacement = [
                    {
                        "needle": "$dirname$", 
                        "replacement": __dirname + "/Backends"
                    },
                    {
                        "needle": "$filepath$", 
                        "replacement": process.file + format.file_suffix
                    }
                ];

            var args = lib.replaceTemplateList(backend.tool_args, fileAndPathReplacement);

            lib.logSpecific(args, req.body.windowKey);
            
            process.tool = spawn(lib.replaceTemplate(backend.tool, fileAndPathReplacement), args);

            process.tool.on('error', function (err){
                lib.logSpecific('ERROR: Cannot run the chosen instance generator. Please check whether it is installed and accessible.', req.body.windowKey);
                process = getProcess(req.body.windowKey);
                if (process != null)
                {
                    process.result = '{"message": "' + lib.escapeJSON("Error: Cannot run claferIG") + '"}';
                    process.completed = true;
                    process.tool = null;
                }
            });

            process.tool.stdout.on("data", function (data)
            {
                process = getProcess(req.body.windowKey);
                if (process != null)
                {
                    if (!process.completed)
                    {
                        process.freshData += data;
                    }
                }
            });

            process.tool.stderr.on("data", function (data)
            {
                process = getProcess(req.body.windowKey);
                if (process != null)
                {
                    if (!process.completed){
                        process.freshError += data;
                    }
                }
            });

            process.tool.on("close", function (code)
            {
                process = getProcess(req.body.windowKey);
                if (process != null)
                {
                    process.mode_completed = true;
                    process.tool = null;
                }                
            });


            // if the backend supports production of the scope file, then send this command
            // the command will be handled after the initial processing in any case


            if (backend.scope_options.clafer_scope_list)
            {
                process.tool.stdin.write(backend.scope_options.clafer_scope_list.command);
                process.producedScopes = false;
            }
            else
            {
                process.producedScopes = true;
            }

            res.writeHead(200, { "Content-Type": "text/html"});
            res.end("started");

        }
    }
    else if (req.body.operation == "stop") // "Stop" operation
    {
        lib.logSpecific("Control: Stop", req.body.windowKey);
        process.toKill = true;
        process.mode_completed = true;
        res.writeHead(200, { "Content-Type": "text/html"});
        res.end("stopped");
    }
    else if (req.body.operation == "setGlobalScope") // "Set Global Scope" operation
    {
        lib.logSpecific("Control: setGlobalScope", req.body.windowKey);

        // looking for a backend
        var backend = getBackend(req.body.backend);
        if (!backend)
        {
            lib.logSpecific("Error: Backend was not found", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Could not find the backend by its submitted id.");
            return;
        }

        lib.logSpecific(backend.id + " " + req.body.operation_arg1, req.body.windowKey);

        var replacements = [
                {
                    "needle": "$value$", 
                    "replacement": req.body.operation_arg1
                }
            ];

        var command = lib.replaceTemplate(backend.scope_options.global_scope.command, replacements);
        process.tool.stdin.write(command);
            
        if (backend.scope_options.clafer_scope_list)
        {
            process.tool.stdin.write(backend.scope_options.clafer_scope_list.command);
            process.producedScopes = false;
        }
        else
        {
            process.producedScopes = true;
        }

        res.writeHead(200, { "Content-Type": "text/html"});
        res.end("global_scope_set");
    }
    else if (req.body.operation == "setIndividualScope") // "Set Clafer Scope" operation
    {
        lib.logSpecific("Control: setIndividualScope", req.body.windowKey);

        // looking for a backend
        var backend = getBackend(req.body.backend);
        if (!backend)
        {
            lib.logSpecific("Error: Backend was not found", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Could not find the backend by its submitted id.");
            return;
        }

        lib.logSpecific(backend.id + " " + req.body.operation_arg1 + " " + req.body.operation_arg2, req.body.windowKey);

        var replacements = [
                {
                    "needle": "$clafer$", 
                    "replacement": req.body.operation_arg2
                },
                {
                    "needle": "$value$", 
                    "replacement": req.body.operation_arg1
                }
            ];

        var command = lib.replaceTemplate(backend.scope_options.individual_scope.command, replacements);
        process.tool.stdin.write(command);
            
        if (backend.scope_options.clafer_scope_list)
        {
            process.tool.stdin.write(backend.scope_options.clafer_scope_list.command);
            process.producedScopes = false;
        }
        else
        {
            process.producedScopes = true;
        }

        res.writeHead(200, { "Content-Type": "text/html"});
        res.end("individual_scope_set");
    }
    else if (req.body.operation == "setIntScope") // "Set Integer Scope" operation
    {
        lib.logSpecific("Control: setIntScope", req.body.windowKey);

        // looking for a backend
        var backend = getBackend(req.body.backend);
        if (!backend)
        {
            lib.logSpecific("Error: Backend was not found", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Could not find the backend by its submitted id.");
            return;
        }

        lib.logSpecific(backend.id + " " + req.body.operation_arg1 + " " + req.body.operation_arg2, req.body.windowKey);

        var replacements = [
                {
                    "needle": "$low$", 
                    "replacement": req.body.operation_arg1
                },
                {
                    "needle": "$high$", 
                    "replacement": req.body.operation_arg2
                }
            ];

        var command = lib.replaceTemplate(backend.scope_options.int_scope.command, replacements);
        process.tool.stdin.write(command);
            
        if (backend.scope_options.clafer_scope_list)
        {
            process.tool.stdin.write(backend.scope_options.clafer_scope_list.command);
            process.producedScopes = false;
        }
        else
        {
            process.producedScopes = true;
        }

        res.writeHead(200, { "Content-Type": "text/html"});
        res.end("int_scope_set");
    }
    else // else look for custom commands defined by backend config
    {
        var parts = req.body.operation.split("-");
        if (parts.length != 2)
        {
            lib.logSpecific('Control: Command does not follow pattern "backend-opreration": "' + req.body.operation + '"', req.body.windowKey, req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Command does not follow the 'backend-operation' pattern.");
            return;
        }

        var backendId = parts[0]; // it does not matter how to get backendid.
        var operationId = parts[1];

        var found = false;
        var operation = null;
        // looking for a backend

        var backend = getBackend(backendId);
        if (!backend)
        {
            lib.logSpecific("Error: Backend was not found", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Could not find the backend by its submitted id.");
            return;
        }

        // looking for the operation
        var found = false;

        for (var j = 0; j < backend.control_buttons.length; j++)
        {
            if (backend.control_buttons[j].id == operationId)
            {
                operation = backend.control_buttons[j];
                found = true;
                break;
            }
        }

        if (!found)
        {
            lib.logSpecific("Error: Required operation was not found", req.body.windowKey);
            res.writeHead(400, { "Content-Type": "text/html"});
            res.end("Error: Could not find the required operation.");
            return;
        }

        lib.logSpecific(backend.id + " ==> " + operation.id, req.body.windowKey);

        process.tool.stdin.write(operation.command);

        res.writeHead(200, { "Content-Type": "text/html"});
        res.end("operation");
    }
});


/*
 * "Compile" command
 * This is related to any time of submissions done using the Input view: compiling a file, example or text, etc.
 */
server.post('/upload', commandMiddleware, function(req, res, next) 
{
    lib.handleUploads(req, res, next, fileReady);

    function fileReady(uploadedFilePath, dlDir, loadedViaURL)
    {        

        var loadExampleInEditor = req.body.loadExampleInEditor;
        if (loadedViaURL)
        {
            loadExampleInEditor = true;
        }

        var key = req.body.windowKey;

        // read the contents of the uploaded file
        fs.readFile(uploadedFilePath + ".cfr", function (err, data) {

            var file_contents;
            if(data)
                file_contents = data.toString();
            else
            {
                res.writeHead(500, { "Content-Type": "text/html"});
                res.end("No data has been read");
                lib.cleanupOldFiles(dlDir);
                return;
            }
            
            lib.logSpecific("Compiling...", req.body.windowKey);

            // removing an older session
            for (var i = 0; i < processes.length; i++)
            {
                if (processes[i].windowKey == req.body.windowKey)
                {
                    processes[i].toKill = true;
                    timeoutProcessClearPing(processes[i]);                
                    processes[i].toRemoveCompletely = true;
                    processes[i].windowKey = "none";

                    break;
                }
            }

            var d = new Date();
            var process = { 
                windowKey: req.body.windowKey, 
                toRemoveCompletely: false, 
                tool: null, 
                freshData: "", 
                scopes: "",
                folder: dlDir, 
                clafer_compiler: null,
                file: uploadedFilePath, 
                lastUsed: d,
                mode : "compiler", 
                freshError: ""};


            var ss = "--ss=none";

            lib.logSpecific(req.body.ss, req.body.windowKey);

            if (req.body.ss == "simple")
            {
                ss = "--ss=simple";
            }
            else if (req.body.ss == "full")
            {
                ss = "--ss=full";
            }

            var specifiedArgs = lib.filterArgs(req.body.args);

            var genericArgs = [ss, uploadedFilePath + ".cfr"];
            var formatModeArgs = [];

            process.compiler_args = genericArgs.concat(specifiedArgs).join(" ").replace(uploadedFilePath, "file") + " {mode args}";

            for (var i = 1; i < formatConfig.formats.length; i++)
                // we skip the default source .CFR format, since it's already there
            {
                formatModeArgs.push("-m");
                formatModeArgs.push(formatConfig.formats[i].compiler_mode);
                formatModeArgs = formatModeArgs.concat(formatConfig.formats[i].compiler_args);
            }

            var finalArgs = genericArgs.concat(specifiedArgs).concat(formatModeArgs);

            process.clafer_compiler = spawn("clafer", finalArgs);

            process.compiled_formats = new Array();
            process.compiler_message = "";

            if (loadExampleInEditor)
                process.model = file_contents;
            else
                process.model = "";                                   

            process.clafer_compiler.stdout.on("data", function (data){
                for (var i = 0; i < processes.length; i++)
                {
                    if (processes[i].windowKey == req.body.windowKey)
                    {
                        processes[i].compiler_message += data;
                    }
                }
            });

            process.clafer_compiler.stderr.on("data", function (data){
                for (var i = 0; i<processes.length; i++)
                {
                    if (processes[i].windowKey == req.body.windowKey)
                    {
                        processes[i].compiler_message += data;
                    }
                }
            });
            
            process.clafer_compiler.on('close', function (code)
            {	
                for (var i = 0; i < processes.length; i++)
                {
                    if (processes[i].windowKey == req.body.windowKey)
                    {
                        processes[i].clafer_compiler = null;

                        if (code != 0) // if the result is non-zero, means compilation error
                        {
                            lib.logSpecific("CC: Non-zero Return Value", req.body.windowKey);
                            processes[i].compiler_result = '{"message": "' + lib.escapeJSON("Error: Compilation Error") + '"}';
                            processes[i].compiler_code = 1;
                        }
                        else
                        {
                            lib.logSpecific("CC: Zero Return Value", req.body.windowKey);
                            processes[i].compiler_result = '{"message": "' + lib.escapeJSON("Success") + '"}';
                            processes[i].compiler_code = 0;
                        }


                        // it makes sense to get the compiled files for the models (e.g., HTML) 
                        // that may show syntax errors

                        var formats_for_process = [];

                        for (var j = 0; j < formatConfig.formats.length; j++)
                        {
                            var format = new Object();
                            format.id = formatConfig.formats[j].id;
                            format.file_suffix = formatConfig.formats[j].file_suffix;
                            format.display_element = formatConfig.formats[j].display_element;
                            format.shows_compilation_errors = formatConfig.formats[j].shows_compilation_errors;
                            format.process = processes[i];
                            formats_for_process.push(format);
                        }

                        formats_for_process.forEach(function(item) 
                        {
                            if (item.shows_compilation_errors || (item.process.compiler_code == 0))
                            {
                                fs.readFile(uploadedFilePath + item.file_suffix, function (err, file_contents) 
                                {
                                    var obj = new Object();
                                    obj.id = item.id;
                                    obj.fileSuffix = item.file_suffix;
                                    obj.displayElement = item.display_element;
                                    if (err) // error reading HTML, maybe it is not really present, means a fatal compilation error
                                    {
                                        lib.logSpecific('ERROR: Cannot read the compiled file.', req.body.windowKey);
                                        obj.message = "compile_error";
                                        obj.result = "";
                                    }
                                    else
                                    {
                                        obj.message = "OK";
                                        obj.result = file_contents.toString();
                                    }

                                    item.process.compiled_formats.push(obj);

                                    if (formats_for_process.length == item.process.compiled_formats.length)
                                    {
                                        onAllFormatsCompiled(item.process);
                                    }
                                });
                            }
                            else 
                            {
                                var obj = new Object();
                                obj.id = item.id;
                                obj.message = "compile_error";
                                obj.result = "";
                                item.process.compiled_formats.push(obj);

                                if (formats_for_process.length == item.process.compiled_formats.length)
                                {
                                    onAllFormatsCompiled(item.process);
                                }
                            }
                        });
                    }
                }
            });

            processes.push(process);    
            timeoutProcessSetPing(process);

            res.writeHead(200, { "Content-Type": "text/html"});
            res.end("OK"); // we have to return a response right a way to avoid confusion.               
        });
    }
});

/* =============================================== */
// POLLING Requests
/* ------------------------------------------*/

/*
 * Handle Polling
 * The client will poll the server to get the latest updates or the final result
 * Polling is implemented to solve the browser timeout problem.
 * Moreover, this helps to control the execution of a tool: to stop, or to get intermediate results.
 * An alternative way might be to create a web socket
 */

server.post('/poll', pollingMiddleware, function(req, res, next)
{
    var process = getProcess(req.body.windowKey);
    if (process == null)
    {
        res.writeHead(404, { "Content-Type": "application/json"});
        res.end('{"message": "Error: the requested process is not found."}');     
        // clearing part
        cleanProcesses();
        lib.logSpecific("Client polled", req.body.windowKey);
        return;
    }

    if (req.body.command == "ping") // normal ping
    {               
        timeoutProcessClearPing(process);

        if (process.mode_completed) // the execution of the current mode is completed
        {
            if (process.mode == "compiler") // if the mode completed is compilation
            {       

                res.writeHead(200, { "Content-Type": "application/json"});
                var jsonObj = JSON.parse(process.compiler_result);
                jsonObj.compiled_formats = process.compiled_formats;
                jsonObj.args = process.compiler_args;
                process.compiler_args = "";
                jsonObj.scopes = "";
                jsonObj.model = process.model;
                jsonObj.compiler_message = process.compiler_message;
                res.end(JSON.stringify(jsonObj));

                process.mode = "ig";
                process.mode_completed = false;
            }
            else
            {
                var currentResult = "";

                if (process.freshData != "")
                {
                    currentResult += process.freshData;
                    process.freshData = "";
                }

                if (process.freshError != "")
                {
                    currentResult += process.freshError;
                    process.freshError = "";
                }                    

                res.writeHead(200, { "Content-Type": "application/json"});

                var jsonObj = new Object();
                jsonObj.message = currentResult;
                jsonObj.scopes = "";
                jsonObj.completed = true;
                res.end(JSON.stringify(jsonObj));
            }

            // if mode is completed, then the tool is not busy anymore, so now it's time to 
            // set inactivity timeout

            timeoutProcessClearInactivity(process);
            timeoutProcessSetInactivity(process);
        }   
        else // still working
        {
            timeoutProcessSetPing(process);

            if (process.mode == "compiler") // if the mode completed is compilation
            {
                var jsonObj = new Object();
                jsonObj.message = "Working";
                jsonObj.args = process.compiler_args;
                process.compiler_args = "";
                res.end(JSON.stringify(jsonObj));
            }
            else
            {
                if (!process.producedScopes)
                {
                    var scopesFileName = process.file + ".scopes.json";
                    fs.readFile(scopesFileName, function (err, data) {
                        if (!err)
                        {
                            for (var i = 0; i < processes.length; i++)
                            {
                                if (process.windowKey == req.body.windowKey)
                                {
                                    process.scopes = data.toString();    
                                    process.producedScopes = true;                                    
                                }
                            }

                            // removing the file from the system. 
                            fs.unlink(scopesFileName, function (err){
                                // nothing
                            });
                        }
                    });
                }

                var currentResult = "";

                if (process.freshData != "")
                {
                    currentResult += process.freshData;
                    process.freshData = "";
                }

                if (process.freshError != "")
                {
                    currentResult += process.freshError;
                    process.freshError = "";
                }                    

                res.writeHead(200, { "Content-Type": "application/json"});

                var jsonObj = new Object();
                jsonObj.message = currentResult;
                jsonObj.scopes = process.scopes;

                process.scopes = "";

                jsonObj.completed = false;
                res.end(JSON.stringify(jsonObj));
            }
        }
    }
    else // if it is cancel
    {
        process.toKill = true;
        timeoutProcessClearPing(process);

        // starting inactivity timer
        timeoutProcessClearInactivity(process);
        timeoutProcessSetInactivity(process);

        res.writeHead(200, { "Content-Type": "application/json"});

        var jsonObj = new Object();
        jsonObj.message = "Cancelled";
        jsonObj.scopes = "";
        jsonObj.compiler_message = "Cancelled compilation";
        jsonObj.completed = true;
        res.end(JSON.stringify(jsonObj));

        lib.logSpecific("Cancelled: " + process.toKill, req.body.windowKey);
    }
    
    // clearing part
    cleanProcesses();
    lib.logSpecific("Client polled", req.body.windowKey);
    
});

/*
 * Catch all the rest. Error reporting for unknown routes
 */
server.use(function(req, res, next)
{
    lib.logSpecific(req.url, null);
    res.send(404, "Sorry can't find that!");
});

function pingTimeoutFunc(process)
{
    lib.logSpecific("Error: Ping Timeout", process.windowKey);
    process.result = '{"message": "' + lib.escapeJSON('Error: Ping Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.pingTimeout + ' millisecond(s).') + '"}';
    process.toKill = true;   
    process.toRemoveCompletely = true;   
    cleanProcesses();
}

function inactivityTimeoutFunc(process)
{
    lib.logSpecific("Error: Inactivity Timeout", process.windowKey);
    process.result = '{"message": "' + lib.escapeJSON('Error: Inactivity Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.inactivityTimeout + ' millisecond(s).') + '"}';
    process.toKill = true;   
    process.toRemoveCompletely = true;   
    cleanProcesses();
}

function cleanProcesses()
{
    var i = 0;
    while (i < processes.length)
    {
        if (processes[i].toKill)
        {
            killProcessTree(processes[i]);
            processes[i].toKill = false;
        }

        if (processes[i].toRemoveCompletely)
        {
            clearTimeout(processes[i].pingTimeoutObject);
            clearTimeout(processes[i].inactivityTimeoutObject);
            setTimeout(lib.cleanupOldFiles, config.cleaningTimeout, processes[i].folder);
            processes.splice(i, 1);
        }
        else
            i++;   
    }

    lib.logSpecific("Cleaning complete. #Processes = " + processes.length, null);
}

function onAllFormatsCompiled(process)
{
    process.mode_completed = true;
}

function killProcessTree(process)
{
    var spawn = require('child_process').spawn;
    
    process.killed = true;
    lib.killProcessIfExists(process.tool);    
    process.tool = null;
    lib.killProcessIfExists(process.clafer_compiler);    
    process.clafer_compiler = null;
    lib.logSpecific("Killing the process tree...", process.windowKey);                
}


//================================================================
// Initialization Code
//================================================================

var dependency_count = 2; // the number of tools to be checked before the Visualizer starts
lib.logNormal('===============================');
lib.logNormal('| ClaferIDE v0.3.5.??-??-???? |');
lib.logNormal('===============================');
var spawn = require('child_process').spawn;
lib.logNormal('Checking dependencies...');

var clafer_compiler  = spawn("clafer", ["-V"]);
var clafer_compiler_version = "";
clafer_compiler.on('error', function (err){
    lib.logNormal('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
});
clafer_compiler.stdout.on('data', function (data){	
    clafer_compiler_version += data;
});
clafer_compiler.on('exit', function (code){	
    lib.logNormal(clafer_compiler_version.trim());
    if (code == 0) dependency_ok();
});

var java  = spawn("java", ["-version"]);
var java_version = "";
java.on('error', function (err){
    lib.logNormal('ERROR: Cannot find Java (java). Please check whether it is installed and accessible.');
});
java.stdout.on('data', function (data){	
    java_version += data;
});
java.stderr.on('data', function (data){	
    java_version += data;
});
java.on('exit', function (code){	
    lib.logNormal(java_version.trim());
    if (code == 0) dependency_ok();
});

var node_version = process.version + ", " + JSON.stringify(process.versions);
lib.logNormal("Node.JS: " + node_version);

function dependency_ok()
{
    dependency_count--;
    if (dependency_count == 0)
    {
        server.listen(port);
        lib.logNormal('Dependencies found successfully. Please review their versions manually');        
        lib.logNormal('======================================');
        lib.logNormal('Ready. Listening on port ' + port);        
    }
}

function getProcess(key)
{
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == key)
        {
            return processes[i];
        }
    }

    return null;
}

function timeoutProcessSetPing(process)
{
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == process.windowKey)
        {
            processes[i].pingTimeoutObject = setTimeout(pingTimeoutFunc, config.pingTimeout, processes[i]);
            return;
        }
    }
}

function timeoutProcessClearPing(process)
{
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == process.windowKey)
        {
            clearTimeout(processes[i].pingTimeoutObject);
            return;
        }
    }
}

function timeoutProcessSetInactivity(process)
{
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == process.windowKey)
        {
            processes[i].inactivityTimeoutObject = setTimeout(inactivityTimeoutFunc, config.inactivityTimeout, processes[i]);
            return;
        }
    }
}

function timeoutProcessClearInactivity(process)
{
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == process.windowKey)
        {
            clearTimeout(processes[i].inactivityTimeoutObject);
            return;
        }
    }
}

function getBackend(backendId)
{
    for (var j = 0; j < backendConfig.backends.length; j++)
    {
        if (backendConfig.backends[j].id == backendId)
        {
            return backendConfig.backends[j]; 
        }
    }
    return null;
}

function getFormat(formatId){
    for (var j = 0; j < formatConfig.formats.length; j++)
    {
        if (formatConfig.formats[j].id == formatId)
        {
            return formatConfig.formats[j];
        }
    }

    return null;
}
