//====================================================
// Libraries and misc functions
//====================================================
var fs = require("fs");
var http = require("http");
var core = require("./core_lib");
var formatConfig = require('./../Formats/formats.json');
var spawn = require('child_process').spawn;    
var ROOT = __dirname.substring(0, __dirname.length - "/commons".length);

var handleUploads = function(req, res, next, finalCallback)
	{

		core.logSpecific("---Upload request initiated.", req.body.windowKey);

	    var key = req.body.windowKey;
	    var fileTextContents = req.body.claferText;
	    var currentURL = "";
	    var urlFile = false; // the file is passed via URL 

	    var uploadedFilePath = "";
	    
		//check if client has either a file directly uploaded or a url location of a file
	   	
	    if (req.body.exampleFlag == "1")
	    {
	        if (req.body.exampleURL !== undefined && req.body.exampleURL !== "") // if example submitted
	        {
	            core.logSpecific(req.headers.host, req.body.windowKey);
	            currentURL = "http://" + req.headers.host + "/Examples/" + req.body.exampleURL;                
	        }
	        else
	        {
	            core.logSpecific("No example submitted. Returning...", req.body.windowKey);
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
	            urlFile = true;
	        }
	    
	        if (!found) // if no URL was submitted
	        {
	            // then we have a series of checks, whether the file is submitted, exists, and non-empty
	            if (!req.files.claferFile)
	            {
	                core.logSpecific("No clafer file submitted. Returning...", req.body.windowKey);
	                res.writeHead(200, { "Content-Type": "text/html"});
	                res.end("no clafer file submitted");
	                return;        
	            }
	        
	            uploadedFilePath = req.files.claferFile.path;
	            if (!fs.existsSync(uploadedFilePath))
	            {
	                core.logSpecific("No Clafer file submitted. Returning...", req.body.windowKey);
	                res.writeHead(200, { "Content-Type": "text/html"});
	                res.end("no clafer file submitted");
	                return;
	            }
	            var pre_content = fs.readFileSync(uploadedFilePath);
	            if (pre_content.length == 0)
	            {
	                core.logSpecific("No Clafer file submitted. Returning...", req.body.windowKey);
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
	        uploadedFilePath = ROOT + "/uploads/" + uploadedFilePath;
	        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
	            i = i+1;
	        }
	        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
	        
	        core.logSpecific('Creating a file with the contents...', req.body.windowKey);

	        core.logSpecific(fileTextContents, req.body.windowKey);

	        fs.writeFile(uploadedFilePath, fileTextContents, function(err) {
	            if(err) {
	                core.logSpecific(err, req.body.windowKey);
	            } else {
	                core.logSpecific("The file was saved to ./uploads", req.body.windowKey);
	                moveUploadedFile(req, res, next, uploadedFilePath, urlFile, finalCallback);
	            }
	        });

	    }
	    
	/* downloading the file, if required */ 

	    if (currentURL != "")
	    {
	        var i = 0;
	        uploadedFilePath = req.body.windowKey;
	        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
	        uploadedFilePath = ROOT + "/uploads/" + uploadedFilePath;
	        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
	            i = i+1;
	        }
	        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
	        
	        core.logSpecific('Downloading file at "' + currentURL + '"...', req.body.windowKey);
	        var file = fs.createWriteStream(uploadedFilePath);
	        http.get(currentURL, function(httpRes){
	            httpRes.on('data', function (data) {
	                file.write(data);
	            }).on('end', function(){
	                file.end();
	                core.logSpecific("File downloaded to ./uploads", req.body.windowKey);
	                moveUploadedFile(req, res, next, uploadedFilePath, urlFile, finalCallback);
	            });
	        });
	    }
	    else
	    {
	        if (req.body.exampleFlag != "2") 
	        	moveUploadedFile(req, res, next, uploadedFilePath, urlFile, finalCallback);
	    }
	};

var moveUploadedFile = function (req, res, next, uploadedFilePath, urlFile, callback)
	{                    
	    var i = 0;
	    while(fs.existsSync("./uploads/" + i + "tempfolder/")){
	        i++;
	    }
	    core.logSpecific("Uploaded file: " + uploadedFilePath, req.body.windowKey);
	    var pathTokens = "." + uploadedFilePath.split("Server")[1];
	    core.logSpecific("Partial path: " + pathTokens, req.body.windowKey);
	    
	    var pathTokensLinux = pathTokens.split("/");
	    var pathTokensWindows = pathTokens.split("\\");
	    
	    if (pathTokensWindows.length > pathTokensLinux.length)
	        pathTokens = pathTokensWindows;
	    else    
	        pathTokens = pathTokensLinux;
	    
	    core.logSpecific('Path tokens: "' + pathTokens.join('; ') + '"', req.body.windowKey);
	    var oldPath = uploadedFilePath;
	    uploadedFilePath = ROOT + "/" + pathTokens[1] + "/" + i + "tempfolder/"; // this slash will work anyways
	    fs.mkdir(uploadedFilePath, function (err){
	        if (err) throw err;
	        var uploadedFileDir = uploadedFilePath;
	        uploadedFilePath += pathTokens[2];
	        uploadedFilePath = uploadedFilePath.substring(0, uploadedFilePath.length - 4); // to remove the extention

	        fs.rename(oldPath, uploadedFilePath + ".cfr", function (err){
	            if (err) throw err;
	            core.logSpecific("Proceeding with " + uploadedFilePath, req.body.windowKey);
	            callback(uploadedFilePath, uploadedFileDir, urlFile);
	        });
	    });
	};


var runClaferCompiler = function(key, specifiedArgs, genericArgs, onComplete)
{
    var formatModeArgs = [];
    var process = core.getProcess(key);

    process.compiler_args = genericArgs.concat(specifiedArgs).join(" ").replace(process.file, "file") + " {mode args}";

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

    process.clafer_compiler.stdout.on("data", function (data)
    {
        var process = core.getProcess(key);
        if (process != null)
        {                    
            process.compiler_message += data;
        }
    });

    process.clafer_compiler.stderr.on("data", function (data)
    {
        var process = core.getProcess(key);
        if (process != null)
        {
            process.compiler_message += data;
        }
    });
    
    process.clafer_compiler.on('close', function (code)
    {	
        var process = core.getProcess(key);
        if (process != null)
        {
            process.clafer_compiler = null;

            if (code != 0) // if the result is non-zero, means compilation error
            {
                core.logSpecific("CC: Non-zero Return Value", key);
                process.compiler_result = '{"message": "' + core.escapeJSON("Error: Compilation Error") + '"}';
                process.compiler_code = 1;
            }
            else
            {
                core.logSpecific("CC: Zero Return Value", key);
                process.compiler_result = '{"message": "' + core.escapeJSON("Success") + '"}';
                process.compiler_code = 0;
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
                format.process = process;
                formats_for_process.push(format);
            }

            formats_for_process.forEach(function(item) 
            {
                if (item.shows_compilation_errors || (item.process.compiler_code == 0))
                {
                    fs.readFile(process.file + item.file_suffix, function (err, file_contents) 
                    {
                        var obj = new Object();
                        obj.id = item.id;
                        obj.fileSuffix = item.file_suffix;
                        obj.displayElement = item.display_element;
                        if (err) // error reading HTML, maybe it is not really present, means a fatal compilation error
                        {
                            core.logSpecific('ERROR: Cannot read the compiled file.', key);
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
                        	onComplete();
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
                        onComplete();
                    }
                }
            });
        }
    });

};

module.exports.handleUploads = handleUploads;
module.exports.runClaferCompiler = runClaferCompiler;
