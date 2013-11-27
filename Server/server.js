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

var port = config.port;

var server = express();

//support for sessions - used for url uploads
server.use(express.cookieParser('asasdhf89adfhj0dfjask'));
var store = new express.session.MemoryStore;
server.use(express.session({secret: 'supersecretstring', store: store}));

server.use(express.static(__dirname + '/Client'));
//server.use(express.static(__dirname + '/Client/'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));

var URLs = [];
var processes = [];

server.get('/Examples/:file', function(req, res) {
    res.sendfile('Examples/' + req.params.file);
});

server.get('/Backends/:file', function(req, res) {
    res.sendfile('Backends/' + req.params.file);
});

server.get('/Formats/:file', function(req, res) {
    res.sendfile('Formats/' + req.params.file);
});

server.get('/', function(req, res) {
//uploads now and runs once app.html is fully loaded
//works because client currently sends one empty post upon completion of loading
	if (req.query.claferFileURL) {
		var sessionURL = new Object
		sessionURL.session = req.sessionID;
		sessionURL.url = req.query.claferFileURL;
		URLs.push(sessionURL);
		console.log(req.sessionID);
	}
    res.sendfile("Client/app.html");
});

server.get('/htmlwrapper', function(req, res) {
    res.sendfile("Client/compiler_html_wrapper.html");
});

server.post('/control', function(req, res){
    console.log("Control: Enter");

    var isError = true;
    var resultMessage = "Error: Could not find the process"; // default message

    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == req.body.windowKey)
        {
            if (req.body.operation == "run")
            {
                console.log("Control: Run");

                var backendId = req.body.backend;
                console.log("Backend: " + backendId);
                if (processes[i].mode != "ig")
                {
                    console.log("Error: Not compiled yet");
                    resultMessage = "Error: The mode is not IG: the compilation is still running";
                    isError = true;
                    break;
                }
                else
                {
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
                        console.log("Error: Backend was not found");
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
                        console.log("Error: Required format was not found");
                        resultMessage = "Error: Could not find the required file format.";
                        isError = true;
                        break;
                    }

                    console.log(backend.id + " ==> " + format.id);
                    processes[i].mode_completed = false;

                    var fileAndPathReplacement = [
                            {
                                "needle": "$dirname$", 
                                "replacement": __dirname + "/Backends"
                            },
                            {
                                "needle": "$filepath$", 
                                "replacement": processes[i].file + format.file_extension
                            }
                        ];

                    var args = replaceTemplateList(backend.tool_args, fileAndPathReplacement);

                    console.log(args);
                    
                    processes[i].tool = spawn(replaceTemplate(backend.tool, fileAndPathReplacement), args);

                    processes[i].tool.on('error', function (err){
                        console.log('ERROR: Cannot find Clafer Instance Generator (claferIG). Please check whether it is installed and accessible.');
                        for (var i = 0; i < processes.length; i++)
                        {
                            if (processes[i].windowKey == req.body.windowKey)
                            {
                                processes[i].result = '{"message": "' + escapeJSON("Error: Cannot run claferIG") + '"}';
//                                processes[i].code = 0;
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
                        console.log("CLAFERIG: On Exit");

                        for (var i = 0; i<processes.length; i++){

                            if (processes[i].windowKey == req.body.windowKey)
                            {
//                                cleanupOldFiles(processes[i].file, processes[i].folder);
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
            else if (req.body.operation == "stop")
            {
                console.log("Control: Stop");
                processes[i].toKill = true;
                processes[i].mode_completed = true;
                resultMessage = "stopped";
                isError = false;
                clearTimeout(processes[i].pingTimeoutObject);                
            }
            else if (req.body.operation == "setGlobalScope")
            {
                console.log("Control: setGlobalScope");

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
                    console.log("Error: Backend was not found");
                    resultMessage = "Error: Could not find the backend by its submitted id.";
                    isError = true;
                    break;
                }

                console.log(backend.id + " " + req.body.operation_arg1);

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
            else if (req.body.operation == "setIndividualScope")
            {
                console.log("Control: setIndividualScope");

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
                    console.log("Error: Backend was not found");
                    resultMessage = "Error: Could not find the backend by its submitted id.";
                    isError = true;
                    break;
                }

                console.log(backend.id + " " + req.body.operation_arg1 + " " + req.body.operation_arg2);

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
            else
            {
                var parts = req.body.operation.split("-");
                if (parts.length != 2)
                {
                    console.log('Control: Command does not follow pattern "backend-opreration": "' + req.body.operation + '"');
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
                    console.log("Error: Backend was not found");
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
                    console.log("Error: Required operation was not found");
                    resultMessage = "Error: Could not find the required operation.";
                    break;
                }
                console.log(backend.id + " ==> " + operation.id);

                processes[i].tool.stdin.write(operation.command);

                resultMessage = "operation";
                isError = false;
            }

            // resetting the execution timeout
//            if (processes[i].executionTimeoutObject)
//            {
//                clearTimeout(processes[i].executionTimeoutObject);
//                processes[i].executionTimeoutObject = setTimeout(executionTimeoutFunc, config.executionTimeout, processes[i]);
//            }

            break;

        }
    }

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
 * Handle Polling
 * The client will poll the server to get the latest updates or the final result
 * Polling is implemented to solve the browser timeout problem.
 * Moreover, this helps to control the execution of ClaferMoo: to stop, or to get intermediate results.
 * An alternative way might be to create a web socket
 */

server.post('/poll', function(req, res, next)
{
    var found = false;
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].pingTimeout)
        {
            processes[i].toRemoveCompletely = true;   
            console.log("pingTimeout");
        }
        else
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
                    }	
                    else // still working
                    {
                        processes[i].pingTimeoutObject = setTimeout(pingTimeoutFunc, config.pingTimeout, processes[i]);                      

                        if (processes[i].mode == "compiler") // if the mode completed is compilation
                        {
                            res.writeHead(200, { "Content-Type": "application/json"});
                            res.end('{"message": "Working"}');
                        }
                        else
                        {
                            if (!processes[i].producedScopes)
                            {
                                fs.readFile(processes[i].file + ".scopes.json", function (err, data) {
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
                    res.writeHead(200, { "Content-Type": "application/json"});

                    var jsonObj = new Object();
                    jsonObj.message = "Cancelled";
                    jsonObj.scopes = "";
                    jsonObj.compiler_message = "Cancelled compilation";
                    jsonObj.completed = true;
                    res.end(JSON.stringify(jsonObj));

                    console.log("Cancelled: " + processes[i].toKill);
               }
               break;
            }
        }    
    }
    
    if (!found)
    {
        res.writeHead(404, { "Content-Type": "application/json"});
        res.end('{"message": "Error: the requested process is not found."}');
    }

    // clearing part
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
            cleanupOldFiles(processes[i].folder);            
            clearTimeout(processes[i].pingTimeoutObject);
            processes.splice(i, 1);
        }
        else
            i++;
    }

    console.log("Polled client " + req.body.windowKey + ". #Processes: " + processes.length);
    
});

/*
 * Handle file upload
 */
server.post('/upload', function(req, res, next) 
{
	console.log("---------------------------");
	console.log("/Upload request initiated.");

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
            console.log(req.headers.host);
            currentURL = "http://" + req.headers.host + "/Examples/" + req.body.exampleURL;                
        }
        else
        {
            console.log("No example submitted. Returning...");
            res.writeHead(200, { "Content-Type": "text/html"});
            res.end("no clafer file submitted");
            return;
        }		
	} 
    else if (req.body.exampleFlag == "0")
    {    
        // first, check for the URL clafer file name. It happens only on clafer file submit, not the example file submit
        var found = false;
        for (var x = 0; x < URLs.length; x++)
        {
            if (URLs[x].session === req.sessionID && ("claferFileURL=" + URLs[x].url) === url.parse(req.body.claferFileURL).query)
            {
                currentURL = URLs[x].url;
                URLs.splice(x,1);
                found = true;
                // files loaded by URL which are not examples should be loaded in editor by default
                loadExampleInEditor = true;
                break;
            }
        }
    
        if (!found) // if no URL was submitted
        {
            // then we have a series of checks, whether the file is submitted, exists, and non-empty
            if (!req.files.claferFile)
            {
                console.log("No clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;        
            }
        
            uploadedFilePath = req.files.claferFile.path;
            if (!fs.existsSync(uploadedFilePath))
            {
                console.log("No Clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }
            var pre_content = fs.readFileSync(uploadedFilePath);
            if (pre_content.length == 0)
            {
                console.log("No Clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }        
        }
	}
    else // (req.body.exampleFlag == "2") submitted a text
    {    
        var i = 0;
        uploadedFilePath = req.sessionID;
        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
        uploadedFilePath = __dirname + "/uploads/" + uploadedFilePath;
        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
            i = i+1;
        }
        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
        
        console.log('Creating a file with the contents...');

        console.log(fileTextContents);

        fs.writeFile(uploadedFilePath, fileTextContents, function(err) {
            if(err) {
                console.log(err);
            } else {
                console.log("The file was saved to ./uploads");
                fileReady();
            }
        });

    }
    
/* downloading the file, if required */ 

    if (currentURL != "")
    {
        var i = 0;
        uploadedFilePath = req.sessionID;
        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
        uploadedFilePath = __dirname + "/uploads/" + uploadedFilePath;
        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
            i = i+1;
        }
        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
        
        console.log('Downloading file at "' + currentURL + '"...');
        var file = fs.createWriteStream(uploadedFilePath);
        http.get(currentURL, function(httpRes){
            httpRes.on('data', function (data) {
                file.write(data);
            }).on('end', function(){
                file.end();
                console.log("File downloaded to ./uploads");
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
    //    console.log(resp);
        while(fs.existsSync("./uploads/" + i + "tempfolder/")){
            i++;
        }
        console.log("Uploaded file: " + uploadedFilePath);
        var pathTokens = "." + uploadedFilePath.split("Server")[1];
        console.log("Partial path: " + pathTokens);
        
        var pathTokensLinux = pathTokens.split("/");
        var pathTokensWindows = pathTokens.split("\\");
        
        if (pathTokensWindows.length > pathTokensLinux.length)
            pathTokens = pathTokensWindows;
        else    
            pathTokens = pathTokensLinux;
        
        console.log('Path tokens: "' + pathTokens.join('; ') + '"');
        var oldPath = uploadedFilePath;
        uploadedFilePath = __dirname + "/" + pathTokens[1] + "/" + i + "tempfolder/"; // this slash will work anyways
        fs.mkdir(uploadedFilePath, function (err){
            if (err) throw err;
            var dlDir = uploadedFilePath;
            uploadedFilePath += pathTokens[2];
            uploadedFilePath = uploadedFilePath.substring(0, uploadedFilePath.length - 4); // to remove the extention

            fs.rename(oldPath, uploadedFilePath + ".cfr", function (err){
                if (err) throw err;
                console.log("Proceeding with " + uploadedFilePath);
                
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
                    
                    console.log("Compiling...");

//                    var process = { windowKey: key, tool: null, folder: dlDir, path: uploadedFilePath, completed: false, killed:false, contents: file_contents, toKill: false};

//                    clafer_compiler.on('error', function (err){
//                        console.log('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
//                        res.writeHead(400, { "Content-Type": "text/html"});
//                        res.end("error");
//                    });


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

                    // temporary
                    var clafer_compiler_CHOCO  = spawn("clafer", ["--mode=choco", "--ss=none", "-k", uploadedFilePath + ".cfr"]);
                    // -------

                    process.clafer_compiler  = spawn("clafer", ["--mode=HTML", "--self-contained", "-k", "--add-comments", "--ss=none", uploadedFilePath + ".cfr"]);

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
                                    console.log("CC: Non-zero Return Value");
                                    processes[i].compiler_result = '{"message": "' + escapeJSON("Error: Compilation Error") + '"}';
                                    processes[i].compiler_code = 1;
                                }
                                else
                                {
                                    console.log("CC: Zero Return Value");
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
                                    format.file_extension = formatConfig.formats[j].file_extension;
                                    format.shows_compilation_errors = formatConfig.formats[j].shows_compilation_errors;
                                    format.process = processes[i];
                                    formats_for_process.push(format);
                                }

                                formats_for_process.forEach(function(item) 
                                {
                                    if (item.shows_compilation_errors || (item.process.compiler_code == 0))
                                    {
                                        fs.readFile(uploadedFilePath + item.file_extension, function (err, file_contents) 
                                        {
                                            var obj = new Object();
                                            obj.id = item.id;
                                            if (err) // error reading HTML, maybe it is not really present, means a fatal compilation error
                                            {
                                                console.log('ERROR: Cannot read the compiled file.');
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

function onAllFormatsCompiled(process)
{
    process.mode_completed = true;
}

/*
    process.executionTimeoutObject = setTimeout(executionTimeoutFunc, config.executionTimeout, process);
    process.pingTimeoutObject = setTimeout(pingTimeoutFunc, config.pingTimeout, process);

                        var args = [uploadedFilePath];
    
    tool = spawn("claferIG", args);

    process.tool = tool;
    process.html = html.toString();
    processes.push(process);

    tool.on('error', function (err){
        console.log('ERROR: Cannot find Clafer Instance Generator (claferIG). Please check whether it is installed and accessible.');
        for (var i = 0; i < processes.length; i++)
        {
            if (processes[i].windowKey == req.body.windowKey)
            {
                processes[i].result = '{"message": "' + escapeJSON("Error: Cannot run claferIG") + '"}';
                processes[i].code = 0;
                processes[i].completed = true;
                processes[i].tool = null;
            }
        }
    });

    tool.stdout.on("data", function (data){
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

    tool.stderr.on("data", function (data){
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

    tool.on("close", function (code){
        console.log("CLAFERIG: On Exit");
        for (var i = 0; i<processes.length; i++){

            if (processes[i].windowKey == req.body.windowKey)
            {
                cleanupOldFiles(processes[i].file, processes[i].folder);
            }
        }
    });



*/

function pingTimeoutFunc(process)
{
    console.log("Error: Ping Timeout.");
    process.result = '{"message": "' + escapeJSON('Error: Ping Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.pingTimeout + ' millisecond(s).') + '"}';
//    process.code = 9004;
    process.pingTimeout = true;
    process.toKill = true;
}

function finishCleanup(dir, results){
	if (fs.existsSync(dir)){
		fs.rmdir(dir, function (err) {
  			if (err) {
                console.log("Could not finish the cleanup: " + dir);
                return;
            };
 			console.log("Successfully deleted " + dir + " along with contents:\n" + results);
		});
	}
}
 
function cleanupOldFiles(dir) {
    console.log("Cleaning temporary files...");                    
	//cleanup old files
	fs.readdir(dir, function(err, files){
		//if (err) throw err;
        if (err) 
        {
            console.log("Could not clear the folder: " + dir);
            return; // cannot get the folder
        }
		var results = "";
		var numFiles = files.length;
		console.log("#Files = " + numFiles);
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

function changeFileExt(name, ext, newExt)
{
	var ending = name.toLowerCase().substring(name.length - 4);
	if (ending == ext.toLowerCase())
		return name.substring(0, name.length - 4) + newExt;

	return name;
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
        console.log("Killing the backend tree with Parent PID = " + pid);
    
        // first, try a Windows command
        var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", pid]);
        
        killer_win.on('error', function (err){	// if error occurs, then we are on Linux
            var killer_linux = spawn("pkill", ["-TERM", "-P", pid]);                   

            killer_linux.on('error', function(err){
                console.log("Cannot terminate the backend.");
            });
        });                
    }

    if (process.clafer_compiler)
    {
        var pid = process.clafer_compiler.pid;
        process.clafer_compiler.removeAllListeners();
        process.clafer_compiler = null;
        console.log("Killing the compiler tree with Parent PID = " + pid);
    
        // first, try a Windows command
        var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", pid]);
        
        killer_win.on('error', function (err){  // if error occurs, then we are on Linux
            var killer_linux = spawn("pkill", ["-TERM", "-P", pid]);                   

            killer_linux.on('error', function(err){
                console.log("Cannot terminate the compiler.");
            });
        });                
    }
                
}


/*
 * Catch all. error reporting for unknown routes
 */
server.use(function(req, res, next){

    console.log(req.url);
    
    if (req.url.substring(0, "/Examples/".length) == "/Examples/") // allow only Examples folder
    {
        res.sendFile(req.url.substring(1));
    }
    else
        res.send(404, "Sorry can't find that!");
});

var dependency_count = 2; // the number of tools to be checked before the Visualizer starts
console.log('===============================');
console.log('| ClaferIDE v0.3.5.??-??-???? |');
console.log('===============================');
var spawn = require('child_process').spawn;
console.log('Checking dependencies...');

var clafer_compiler  = spawn("clafer", ["-V"]);
var clafer_compiler_version = "";
clafer_compiler.on('error', function (err){
    console.log('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
});
clafer_compiler.stdout.on('data', function (data){	
    clafer_compiler_version += data;
});
clafer_compiler.on('exit', function (code){	
    console.log(clafer_compiler_version.trim());
    if (code == 0) dependency_ok();
});

var java  = spawn("java", ["-version"]);
var java_version = "";
java.on('error', function (err){
    console.log('ERROR: Cannot find Java (java). Please check whether it is installed and accessible.');
});
java.stdout.on('data', function (data){	
    java_version += data;
});
java.stderr.on('data', function (data){	
    java_version += data;
});
java.on('exit', function (code){	
    console.log(java_version.trim());
    if (code == 0) dependency_ok();
});

/* uncommented this check, since we have many backends now 
var claferMoo  = spawn(pythonPath, [tool_path + python_file_name, "--version"]);
var claferMoo_version = "";
// 'error' would mean that there is no python, which has been checked already
claferMoo.on('error', function (err){
    console.log('ERROR: Cannot run ClaferMoo (' + tool_path + python_file_name + '). Please check whether it is installed and accessible.');
});
claferMoo.stdout.on('data', function (data){	
    claferMoo_version += data;
});
claferMoo.stderr.on('data', function (data){	
    claferMoo_version += data;
});
claferMoo.on('exit', function (code){	
    if (code != 0)
        console.log('ERROR: Cannot run ClaferMoo (' + tool_path + python_file_name + '). Please check whether it is installed and accessible.');
    
    console.log(claferMoo_version.trim());
    if (code == 0) dependency_ok();
});
*/
var node_version = process.version + ", " + JSON.stringify(process.versions);
console.log("Node.JS: " + node_version);

function dependency_ok()
{
    dependency_count--;
    if (dependency_count == 0)
    {
        server.listen(port);
        console.log('Dependencies found successfully. Please review their versions manually');        
        console.log('======================================');
        console.log('Ready. Listening on port ' + port);        
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