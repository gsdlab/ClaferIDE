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
var http = require("http");
var url = require("url");
var sys = require("sys");
var fs = require("fs");
var path = require('path');
var express = require('express');
var config = require('./config.json');
var crypto = require('crypto'); // for getting hashes
var backendConfig = require('./Backends/backends.json');
var formatConfig = require('./Formats/formats.json');

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

    logSpecific("Save format request", req.query.windowKey);

    var errorMessage = "process_not_found"; // default message

    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == req.query.windowKey)
        {
            var formatId = req.query.fileid;
            var found = false;
            var format = null;
            // looking for a backend

            for (var j = 0; j < formatConfig.formats.length; j++)
            {
                if (formatConfig.formats[j].id == formatId)
                {
                    found = true;
                    format = formatConfig.formats[j]; 
                    break;
                }
            }

            if (!found)
            {
                logSpecific("Error: Format was not found", req.query.windowKey);
                errorMessage = "Error: Could not find the format by its submitted id: " + formatId;
                break;
            }

            var fileName = processes[i].file + format.file_suffix;

            fs.readFile(fileName, function (err, data) {

                if (data)
                {
                    res.writeHead(200, { "Content-Type": "text/html",
                                 "Content-Disposition": "attachment; filename=compiled" + format.file_suffix});
                    res.end(data.toString());
                }
                else
                {
                    logSpecific("Error: Could not read file", req.query.windowKey);
                    res.writeHead(400, { "Content-Type": "text/html"});
                    res.end("Could not read the file data");
                }
            });

            return;
        }
    }

    res.writeHead(400, { "Content-Type": "text/html"});    
    res.end(errorMessage);        
});

//-------------------------------------------------
//  Command Requests
//-------------------------------------------------

/* Controlling Instance Generators */
server.post('/control', commandMiddleware, function(req, res){
    logSpecific("Control: Enter", req.body.windowKey);

    var isError = true;
    var resultMessage = "process_not_found"; // default message

    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == req.body.windowKey)
        {
            if (req.body.operation == "run") // "Run" operation
            {
                logSpecific("Control: Run", req.body.windowKey);

                var backendId = req.body.backend;
                logSpecific("Backend: " + backendId, req.body.windowKey);
                if (processes[i].mode != "ig")
                {
                    logSpecific("Error: Not compiled yet", req.body.windowKey);
                    resultMessage = "Error: The mode is not IG: the compilation is still running";
                    isError = true;
                    break;
                }
                else
                {
                    clearTimeout(processes[i].inactivityTimeoutObject); // reset the inactivity timeout

                    var found = false;
                    var backend = null;
                    var format = null;
                    // looking for a backend

                    for (var j = 0; j < backendConfig.backends.length; j++)
                    {
                        if (backendConfig.backends[j].id == backendId)
                        {
                            found = true;
                            backend = backendConfig.backends[j]; 
                            break;
                        }
                    }

                    if (!found)
                    {
                        logSpecific("Error: Backend was not found", req.body.windowKey);
                        resultMessage = "Error: Could not find the backend by its submitted id.";
                        isError = true;
                        break;
                    }

                    // looking for a format
                    var found = false;

                    for (var j = 0; j < formatConfig.formats.length; j++)
                    {
                        if (formatConfig.formats[j].id == backend.accepted_format)
                        {
                            format = formatConfig.formats[j];
                            found = true;
                            break;
                        }
                    }

                    if (!found)
                    {
                        logSpecific("Error: Required format was not found", req.body.windowKey);
                        resultMessage = "Error: Could not find the required file format.";
                        isError = true;
                        break;
                    }

                    logSpecific(backend.id + " ==> " + format.id, req.body.windowKey);
                    processes[i].mode_completed = false;

                    var fileAndPathReplacement = [
                            {
                                "needle": "$dirname$", 
                                "replacement": __dirname + "/Backends"
                            },
                            {
                                "needle": "$filepath$", 
                                "replacement": processes[i].file + format.file_suffix
                            }
                        ];

                    var args = replaceTemplateList(backend.tool_args, fileAndPathReplacement);

                    logSpecific(args, req.body.windowKey);
                    
                    processes[i].tool = spawn(replaceTemplate(backend.tool, fileAndPathReplacement), args);

                    processes[i].tool.on('error', function (err){
                        logSpecific('ERROR: Cannot run the chosen instance generator. Please check whether it is installed and accessible.', req.body.windowKey);
                        for (var i = 0; i < processes.length; i++)
                        {
                            if (processes[i].windowKey == req.body.windowKey)
                            {
                                processes[i].result = '{"message": "' + escapeJSON("Error: Cannot run claferIG") + '"}';
                                processes[i].completed = true;
                                processes[i].tool = null;
                            }
                        }
                    });

                    processes[i].tool.stdout.on("data", function (data){
                        for (var i = 0; i < processes.length; i++)
                        {
                            if (processes[i].windowKey == req.body.windowKey)
                            {
                                if (!processes[i].completed)
                                {
                                    processes[i].freshData += data;
                                }
                            }
                        }
                    });

                    processes[i].tool.stderr.on("data", function (data){
                        for (var i = 0; i<processes.length; i++)
                        {
                            if (processes[i].windowKey == req.body.windowKey)
                            {
                                if (!processes[i].completed){
                                    processes[i].freshError += data;
                                }
                            }
                        }
                    });

                    processes[i].tool.on("close", function (code){
                        logSpecific("IG: On Exit", req.body.windowKey);

                        for (var i = 0; i<processes.length; i++){

                            if (processes[i].windowKey == req.body.windowKey)
                            {
                                processes[i].mode_completed = true;
                                processes[i].tool = null;
                            }
                        }
                        
                    });


                    // if the backend supports production of the scope file, then send this command
                    // the command will be handled after the initial processing in any case


                    if (backend.scope_options.clafer_scope_list)
                    {
                        processes[i].tool.stdin.write(backend.scope_options.clafer_scope_list.command);
                        processes[i].producedScopes = false;
                    }
                    else
                    {
                        processes[i].producedScopes = true;
                    }

                    resultMessage = "started";
                    isError = false;

                }
            }
            else if (req.body.operation == "stop") // "Stop" operation
            {
                logSpecific("Control: Stop", req.body.windowKey);
                processes[i].toKill = true;
                processes[i].mode_completed = true;
                resultMessage = "stopped";
                isError = false;
            }
            else if (req.body.operation == "setGlobalScope") // "Set Global Scope" operation
            {
                logSpecific("Control: setGlobalScope", req.body.windowKey);

                var backendId = req.body.backend;
                var found = false;
                var backend = null;
                // looking for a backend

                for (var j = 0; j < backendConfig.backends.length; j++)
                {
                    if (backendConfig.backends[j].id == backendId)
                    {
                        found = true;
                        backend = backendConfig.backends[j]; 
                        break;
                    }
                }

                if (!found)
                {
                    logSpecific("Error: Backend was not found", req.body.windowKey);
                    resultMessage = "Error: Could not find the backend by its submitted id.";
                    isError = true;
                    break;
                }

                logSpecific(backend.id + " " + req.body.operation_arg1, req.body.windowKey);

                var replacements = [
                        {
                            "needle": "$value$", 
                            "replacement": req.body.operation_arg1
                        }
                    ];

                var command = replaceTemplate(backend.scope_options.global_scope.command, replacements);
                processes[i].tool.stdin.write(command);
                    
                if (backend.scope_options.clafer_scope_list)
                {
                    processes[i].tool.stdin.write(backend.scope_options.clafer_scope_list.command);
                    processes[i].producedScopes = false;
                }
                else
                {
                    processes[i].producedScopes = true;
                }

                resultMessage = "global_scope_set";
                isError = false;
            }
            else if (req.body.operation == "setIndividualScope") // "Set Clafer Scope" operation
            {
                logSpecific("Control: setIndividualScope", req.body.windowKey);

                var backendId = req.body.backend;
                var found = false;
                var backend = null;
                // looking for a backend

                for (var j = 0; j < backendConfig.backends.length; j++)
                {
                    if (backendConfig.backends[j].id == backendId)
                    {
                        found = true;
                        backend = backendConfig.backends[j]; 
                        break;
                    }
                }

                if (!found)
                {
                    logSpecific("Error: Backend was not found", req.body.windowKey);
                    resultMessage = "Error: Could not find the backend by its submitted id.";
                    isError = true;
                    break;
                }

                logSpecific(backend.id + " " + req.body.operation_arg1 + " " + req.body.operation_arg2, req.body.windowKey);

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

                var command = replaceTemplate(backend.scope_options.individual_scope.command, replacements);
                processes[i].tool.stdin.write(command);
                    
                if (backend.scope_options.clafer_scope_list)
                {
                    processes[i].tool.stdin.write(backend.scope_options.clafer_scope_list.command);
                    processes[i].producedScopes = false;
                }
                else
                {
                    processes[i].producedScopes = true;
                }

                resultMessage = "individual_scope_set";
                isError = false;
            }
            else if (req.body.operation == "setIntScope") // "Set Integer Scope" operation
            {
                logSpecific("Control: setIntScope", req.body.windowKey);

                var backendId = req.body.backend;
                var found = false;
                var backend = null;
                // looking for a backend

                for (var j = 0; j < backendConfig.backends.length; j++)
                {
                    if (backendConfig.backends[j].id == backendId)
                    {
                        found = true;
                        backend = backendConfig.backends[j]; 
                        break;
                    }
                }

                if (!found)
                {
                    logSpecific("Error: Backend was not found", req.body.windowKey);
                    resultMessage = "Error: Could not find the backend by its submitted id.";
                    isError = true;
                    break;
                }

                logSpecific(backend.id + " " + req.body.operation_arg1 + " " + req.body.operation_arg2, req.body.windowKey);

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

                var command = replaceTemplate(backend.scope_options.int_scope.command, replacements);
                processes[i].tool.stdin.write(command);
                    
                if (backend.scope_options.clafer_scope_list)
                {
                    processes[i].tool.stdin.write(backend.scope_options.clafer_scope_list.command);
                    processes[i].producedScopes = false;
                }
                else
                {
                    processes[i].producedScopes = true;
                }

                resultMessage = "int_scope_set";
                isError = false;
            }
            else // else look for custom commands defined by backend config
            {
                var parts = req.body.operation.split("-");
                if (parts.length != 2)
                {
                    logSpecific('Control: Command does not follow pattern "backend-opreration": "' + req.body.operation + '"', req.body.windowKey);
                    resultMessage = "Error: Command does not follow the 'backend-operation' pattern.";
                    isError = true;
                }

                var backendId = parts[0]; // it does not matter how to get backendid.
                var operationId = parts[1];

                var found = false;
                var backend = null;
                var operation = null;
                // looking for a backend

                for (var j = 0; j < backendConfig.backends.length; j++)
                {
                    if (backendConfig.backends[j].id == backendId)
                    {
                        found = true;
                        backend = backendConfig.backends[j]; 
                        break;
                    }
                }

                if (!found)
                {
                    logSpecific("Error: Backend was not found", req.body.windowKey);
                    resultMessage = "Error: Could not find the backend specified in the command.";
                    isError = true;
                    break;
                }

                // looking for a format
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
                    logSpecific("Error: Required operation was not found", req.body.windowKey);
                    resultMessage = "Error: Could not find the required operation.";
                    break;
                }
                logSpecific(backend.id + " ==> " + operation.id, req.body.windowKey);

                processes[i].tool.stdin.write(operation.command);

                resultMessage = "operation";
                isError = false;
            }

            break;

        }
    }

    /* Send the response */
    // The function should produce the response anyway, and within reasonable time

    if (!isError)
    {
        res.writeHead(200, { "Content-Type": "text/html"});
    }
    else
    {
        res.writeHead(400, { "Content-Type": "text/html"});
    }
    
    res.end(resultMessage);        
});


/*
 * "Compile" command
 * This is related to any time of submissions done using the Input view: compiling a file, example or text, etc.
 */
server.post('/upload', commandMiddleware, function(req, res, next) 
{
	logSpecific("---Upload request initiated.", req.body.windowKey);

    var key = req.body.windowKey;
    var loadExampleInEditor = req.body.loadExampleInEditor;
    var fileTextContents = req.body.claferText;
    var currentURL = "";
    
    var uploadedFilePath = "";
    
	//check if client has either a file directly uploaded or a url location of a file
   	
    if (req.body.exampleFlag == "1")
    {
        if (req.body.exampleURL !== undefined && req.body.exampleURL !== "") // if example submitted
        {
            logSpecific(req.headers.host, req.body.windowKey);
            currentURL = "http://" + req.headers.host + "/Examples/" + req.body.exampleURL;                
        }
        else
        {
            logSpecific("No example submitted. Returning...", req.body.windowKey);
            res.writeHead(200, { "Content-Type": "text/html"});
            res.end("no clafer file submitted");
            return;
        }		
	} 
    else if (req.body.exampleFlag == "0")
    {    
        // first, check for the URL clafer file name. It happens only on clafer file submit, not the example file submit
        var found = false;

        if (req.body.claferFileURL != "")
        {
            currentURL = req.body.claferFileURL;
            found = true;
            loadExampleInEditor = true;
        }
    
        if (!found) // if no URL was submitted
        {
            // then we have a series of checks, whether the file is submitted, exists, and non-empty
            if (!req.files.claferFile)
            {
                logSpecific("No clafer file submitted. Returning...", req.body.windowKey);
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;        
            }
        
            uploadedFilePath = req.files.claferFile.path;
            if (!fs.existsSync(uploadedFilePath))
            {
                logSpecific("No Clafer file submitted. Returning...", req.body.windowKey);
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }
            var pre_content = fs.readFileSync(uploadedFilePath);
            if (pre_content.length == 0)
            {
                logSpecific("No Clafer file submitted. Returning...", req.body.windowKey);
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }        
        }
	}
    else // (req.body.exampleFlag == "2") submitted a text
    {    
        var i = 0;
        uploadedFilePath = req.body.windowKey;
        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
        uploadedFilePath = __dirname + "/uploads/" + uploadedFilePath;
        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
            i = i+1;
        }
        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
        
        logSpecific('Creating a file with the contents...', req.body.windowKey);

        logSpecific(fileTextContents, req.body.windowKey);

        fs.writeFile(uploadedFilePath, fileTextContents, function(err) {
            if(err) {
                logSpecific(err, req.body.windowKey);
            } else {
                logSpecific("The file was saved to ./uploads", req.body.windowKey);
                fileReady();
            }
        });

    }
    
/* downloading the file, if required */ 

    if (currentURL != "")
    {
        var i = 0;
        uploadedFilePath = req.body.windowKey;
        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
        uploadedFilePath = __dirname + "/uploads/" + uploadedFilePath;
        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
            i = i+1;
        }
        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
        
        logSpecific('Downloading file at "' + currentURL + '"...', req.body.windowKey);
        var file = fs.createWriteStream(uploadedFilePath);
        http.get(currentURL, function(httpRes){
            httpRes.on('data', function (data) {
                file.write(data);
            }).on('end', function(){
                file.end();
                logSpecific("File downloaded to ./uploads", req.body.windowKey);
                fileReady();
            });
        });
    }
    else
    {
        if (req.body.exampleFlag != "2") 
            fileReady();
    }

    function fileReady()
    {
                    
        var i = 0;
    //    logSpecific(resp);
        while(fs.existsSync("./uploads/" + i + "tempfolder/")){
            i++;
        }
        logSpecific("Uploaded file: " + uploadedFilePath, req.body.windowKey);
        var pathTokens = "." + uploadedFilePath.split("Server")[1];
        logSpecific("Partial path: " + pathTokens, req.body.windowKey);
        
        var pathTokensLinux = pathTokens.split("/");
        var pathTokensWindows = pathTokens.split("\\");
        
        if (pathTokensWindows.length > pathTokensLinux.length)
            pathTokens = pathTokensWindows;
        else    
            pathTokens = pathTokensLinux;
        
        logSpecific('Path tokens: "' + pathTokens.join('; ') + '"', req.body.windowKey);
        var oldPath = uploadedFilePath;
        uploadedFilePath = __dirname + "/" + pathTokens[1] + "/" + i + "tempfolder/"; // this slash will work anyways
        fs.mkdir(uploadedFilePath, function (err){
            if (err) throw err;
            var dlDir = uploadedFilePath;
            uploadedFilePath += pathTokens[2];
            uploadedFilePath = uploadedFilePath.substring(0, uploadedFilePath.length - 4); // to remove the extention

            fs.rename(oldPath, uploadedFilePath + ".cfr", function (err){
                if (err) throw err;
                logSpecific("Proceeding with " + uploadedFilePath, req.body.windowKey);
                
                // read the contents of the uploaded file
                fs.readFile(uploadedFilePath + ".cfr", function (err, data) {

                    var file_contents;
                    if(data)
                        file_contents = data.toString();
                    else
                    {
                        res.writeHead(500, { "Content-Type": "text/html"});
                        res.end("No data has been read");
                        cleanupOldFiles(dlDir);
                        return;
                    }
                    
                    logSpecific("Compiling...", req.body.windowKey);

                    // removing an older session
                    for (var i = 0; i < processes.length; i++)
                    {
                        if (processes[i].windowKey == req.body.windowKey)
                        {
                            processes[i].toKill = true;
                            clearTimeout(processes[i].pingTimeoutObject);                
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

                    logSpecific(req.body.ss, req.body.windowKey);

                    if (req.body.ss == "simple")
                    {
                        ss = "--ss=simple";
                    }
                    else if (req.body.ss == "full")
                    {
                        ss = "--ss=full";
                    }

                    var specifiedArgs = filterArgs(req.body.args);

                    var genericArgs = [ss, uploadedFilePath + ".cfr"];
                    var formatModeArgs = [];

                    for (var i = 1; i < formatConfig.formats.length; i++)
                        // we skip the default source .CFR format, since it's already there
                    {
                        formatModeArgs.push("-m");
                        formatModeArgs.push(formatConfig.formats[i].compiler_mode);
                        formatModeArgs = formatModeArgs.concat(formatConfig.formats[i].compiler_args);
                    }

                    var finalArgs = genericArgs.concat(specifiedArgs).concat(formatModeArgs);

                    process.compiler_args = finalArgs.join(" ").replace(uploadedFilePath, "file");
                    process.clafer_compiler = spawn("clafer", finalArgs);

                    process.compiled_formats = new Array();
                    process.compiler_message = "";

                    if (loadExampleInEditor)
                        process.model = file_contents;
                    else
                        process.model = "";                                   

                    process.pingTimeoutObject = setTimeout(pingTimeoutFunc, config.pingTimeout, process);

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
                                    logSpecific("CC: Non-zero Return Value", req.body.windowKey);
                                    processes[i].compiler_result = '{"message": "' + escapeJSON("Error: Compilation Error") + '"}';
                                    processes[i].compiler_code = 1;
                                }
                                else
                                {
                                    logSpecific("CC: Zero Return Value", req.body.windowKey);
                                    processes[i].compiler_result = '{"message": "' + escapeJSON("Success") + '"}';
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
//                                            obj.filePath = uploadedFilePath + item.file_suffix;
                                            obj.displayElement = item.display_element;
                                            if (err) // error reading HTML, maybe it is not really present, means a fatal compilation error
                                            {
                                                logSpecific('ERROR: Cannot read the compiled file.', req.body.windowKey);
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

                    res.writeHead(200, { "Content-Type": "text/html"});
                    res.end("OK"); // we have to return a response right a way to avoid confusion.
                    
                });
            });
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
    var found = false;
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == req.body.windowKey)
        {
            found = true;
            if (req.body.command == "ping") // normal ping
            {                
                clearTimeout(processes[i].pingTimeoutObject);

                if (processes[i].mode_completed) // the execution of the current mode is completed
                {
                    if (processes[i].mode == "compiler") // if the mode completed is compilation
                    {       

                        res.writeHead(200, { "Content-Type": "application/json"});
                        var jsonObj = JSON.parse(processes[i].compiler_result);
                        jsonObj.compiled_formats = processes[i].compiled_formats;
                        jsonObj.args = processes[i].compiler_args;
                        processes[i].compiler_args = "";
                        jsonObj.scopes = "";
                        jsonObj.model = processes[i].model;
                        jsonObj.compiler_message = processes[i].compiler_message;
                        res.end(JSON.stringify(jsonObj));

                        processes[i].mode = "ig";
                        processes[i].mode_completed = false;
                    }
                    else
                    {
                        var currentResult = "";

                        if (processes[i].freshData != "")
                        {
                            currentResult += processes[i].freshData;
                            processes[i].freshData = "";
                        }

                        if (processes[i].freshError != "")
                        {
                            currentResult += processes[i].freshError;
                            processes[i].freshError = "";
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

                    clearTimeout(processes[i].inactivityTimeoutObject);
                    processes[i].inactivityTimeoutObject = setTimeout(inactivityTimeoutFunc, config.inactivityTimeout, processes[i]);

                }   
                else // still working
                {
                    processes[i].pingTimeoutObject = setTimeout(pingTimeoutFunc, config.pingTimeout, processes[i]);                      

                    if (processes[i].mode == "compiler") // if the mode completed is compilation
                    {
                        var jsonObj = new Object();
                        jsonObj.message = "Working";
                        jsonObj.args = processes[i].compiler_args;
                        processes[i].compiler_args = "";
                        res.end(JSON.stringify(jsonObj));
                    }
                    else
                    {
                        if (!processes[i].producedScopes)
                        {
                            var scopesFileName = processes[i].file + ".scopes.json";
                            fs.readFile(scopesFileName, function (err, data) {
                                if (!err)
                                {
                                    for (var i = 0; i < processes.length; i++)
                                    {
                                        if (processes[i].windowKey == req.body.windowKey)
                                        {
                                            processes[i].scopes = data.toString();    
                                            processes[i].producedScopes = true;                                    
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

                        if (processes[i].freshData != "")
                        {
                            currentResult += processes[i].freshData;
                            processes[i].freshData = "";
                        }

                        if (processes[i].freshError != "")
                        {
                            currentResult += processes[i].freshError;
                            processes[i].freshError = "";
                        }                    

                        res.writeHead(200, { "Content-Type": "application/json"});

                        var jsonObj = new Object();
                        jsonObj.message = currentResult;
                        jsonObj.scopes = processes[i].scopes;

                        processes[i].scopes = "";

                        jsonObj.completed = false;
                        res.end(JSON.stringify(jsonObj));
                    }
                }
            }
            else // if it is cancel
            {
                processes[i].toKill = true;
                clearTimeout(processes[i].pingTimeoutObject);                

                // starting inactivity timer
                clearTimeout(processes[i].inactivityTimeoutObject);
                processes[i].inactivityTimeoutObject = setTimeout(inactivityTimeoutFunc, config.inactivityTimeout, processes[i]);

                res.writeHead(200, { "Content-Type": "application/json"});

                var jsonObj = new Object();
                jsonObj.message = "Cancelled";
                jsonObj.scopes = "";
                jsonObj.compiler_message = "Cancelled compilation";
                jsonObj.completed = true;
                res.end(JSON.stringify(jsonObj));

                logSpecific("Cancelled: " + processes[i].toKill, req.body.windowKey);
           }
           break;
        }
    }
    
    if (!found)
    {
        res.writeHead(404, { "Content-Type": "application/json"});
        res.end('{"message": "Error: the requested process is not found."}');
    }

    // clearing part
    cleanProcesses();

    logSpecific("Client polled", req.body.windowKey);
    
});

/*
 * Catch all the rest. Error reporting for unknown routes
 */
server.use(function(req, res, next)
{
    logSpecific(req.url, null);
    res.send(404, "Sorry can't find that!");
});

//====================================================
// Libraries and misc functions
//====================================================

function pingTimeoutFunc(process)
{
    logSpecific("Error: Ping Timeout", process.windowKey);
    process.result = '{"message": "' + escapeJSON('Error: Ping Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.pingTimeout + ' millisecond(s).') + '"}';
    process.toKill = true;   
    process.toRemoveCompletely = true;   
    cleanProcesses();
}

function inactivityTimeoutFunc(process)
{
    logSpecific("Error: Inactivity Timeout", process.windowKey);
    process.result = '{"message": "' + escapeJSON('Error: Inactivity Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.inactivityTimeout + ' millisecond(s).') + '"}';
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
            setTimeout(cleanupOldFiles, config.cleaningTimeout, processes[i].folder);
            processes.splice(i, 1);
        }
        else
            i++;   
    }

    logSpecific("Cleaning complete. #Processes = " + processes.length, null);
}

function onAllFormatsCompiled(process)
{
    process.mode_completed = true;
}

function finishCleanup(dir, results){
	if (fs.existsSync(dir)){
		fs.rmdir(dir, function (err) {
  			if (err) {
                logSpecific("Could not finish the cleanup: " + dir, null);
                return;
            };
 			logSpecific("Successfully deleted " + dir + " along with contents:\n" + results, null);
		});
	}
}
 
function cleanupOldFiles(dir) {
    logSpecific("Cleaning temporary files...", null);                    
	//cleanup old files
	fs.readdir(dir, function(err, files){
		//if (err) throw err;
        if (err) 
        {
            logSpecific("Could not clear the folder: " + dir, null);
            return; // cannot get the folder
        }
		var results = "";
		var numFiles = files.length;
		logSpecific("#Files = " + numFiles, null);
		if (!numFiles){
			return finishCleanup(dir, results);
		} else {
			files.forEach(function(file){
				deleteOld(dir + "/" + file);
				results += file + "\n";
			});	
			finishCleanup(dir, results);
		}
	});


//done cleanup
}

function deleteOld(path){
	if (fs.existsSync(path)){
		fs.unlinkSync(path, function (err) { // added Sync to make sure all files are properly removed until the removal of the directory
			if (err) throw err;
		});
	}
}

function escapeJSON(unsafe) 
{
    return unsafe.replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
}

function killProcessTree(process)
{
    var spawn = require('child_process').spawn;
    
    process.killed = true;
    
    if (process.tool)
    {
        var pid = process.tool.pid;
        process.tool.removeAllListeners();
        process.tool = null;
        logSpecific("Killing the backend tree with Parent PID = " + pid, process.windowKey);
    
        // first, try a Windows command
        var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", pid]);
        
        killer_win.on('error', function (err){	// if error occurs, then we are on Linux
            var killer_linux = spawn("pkill", ["-TERM", "-P", pid]);                   

            killer_linux.on('error', function(err){
                logSpecific("Cannot terminate the backend.", process.windowKey);
            });
        });                
    }

    if (process.clafer_compiler)
    {
        var pid = process.clafer_compiler.pid;
        process.clafer_compiler.removeAllListeners();
        process.clafer_compiler = null;
        logSpecific("Killing the compiler tree with Parent PID = " + pid, process.windowKey);
    
        // first, try a Windows command
        var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", pid]);
        
        killer_win.on('error', function (err){  // if error occurs, then we are on Linux
            var killer_linux = spawn("pkill", ["-TERM", "-P", pid]);                   

            killer_linux.on('error', function(err){
                logSpecific("Cannot terminate the compiler.", process.windowKey);
            });
        });                
    }
                
}


function replaceTemplate(input_string, replacement_map)
{
    var result = input_string;

    for (var j = 0; j < replacement_map.length; j++)
    {
        result = result.replace(replacement_map[j].needle, replacement_map[j].replacement);
    }

    return result;
}

function replaceTemplateList(input_list, replacement_map)
{
    var result = new Array();
    for (var i = 0; i < input_list.length; i++)
    {
        result.push(replaceTemplate(input_list[i], replacement_map));
    }
    
    return result;
}                            

// filter input command line arguments for safety purposes
function filterArgs(argString)
{
    var args = argString.split(" ");
    var resultArgs = new Array();
    for (var i = 0; i < args.length; i++)
    {
        var arg = args[i].trim();

        if (arg.length == 0)
            continue;

        if (!arg.match(/-[A-Za-z-]+/))
            continue;

        resultArgs.push(arg);
    }

    return resultArgs;
}

//================================================================
// Initialization Code
//================================================================

var dependency_count = 2; // the number of tools to be checked before the Visualizer starts
logNormal('===============================');
logNormal('| ClaferIDE v0.3.5.??-??-???? |');
logNormal('===============================');
var spawn = require('child_process').spawn;
logNormal('Checking dependencies...');

var clafer_compiler  = spawn("clafer", ["-V"]);
var clafer_compiler_version = "";
clafer_compiler.on('error', function (err){
    logNormal('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
});
clafer_compiler.stdout.on('data', function (data){	
    clafer_compiler_version += data;
});
clafer_compiler.on('exit', function (code){	
    logNormal(clafer_compiler_version.trim());
    if (code == 0) dependency_ok();
});

var java  = spawn("java", ["-version"]);
var java_version = "";
java.on('error', function (err){
    logNormal('ERROR: Cannot find Java (java). Please check whether it is installed and accessible.');
});
java.stdout.on('data', function (data){	
    java_version += data;
});
java.stderr.on('data', function (data){	
    java_version += data;
});
java.on('exit', function (code){	
    logNormal(java_version.trim());
    if (code == 0) dependency_ok();
});

var node_version = process.version + ", " + JSON.stringify(process.versions);
logNormal("Node.JS: " + node_version);

function dependency_ok()
{
    dependency_count--;
    if (dependency_count == 0)
    {
        server.listen(port);
        logNormal('Dependencies found successfully. Please review their versions manually');        
        logNormal('======================================');
        logNormal('Ready. Listening on port ' + port);        
    }
}

function logSpecific(message, key)
{
    if (key != null)
    {
        console.log(key + " | " + message);
    }
    else 
        console.log("GLOBAL" + " | " + message);
}

function logNormal(message)
{
    console.log(message);
}