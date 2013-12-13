//====================================================
// Libraries and misc functions
//====================================================
var fs = require("fs");
var http = require("http");

var handleUploads = function(req, res, next, finalCallback)
	{

		logSpecific("---Upload request initiated.", req.body.windowKey);

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
	            urlFile = true;
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
	        var uploadedFileDir = uploadedFilePath;
	        uploadedFilePath += pathTokens[2];
	        uploadedFilePath = uploadedFilePath.substring(0, uploadedFilePath.length - 4); // to remove the extention

	        fs.rename(oldPath, uploadedFilePath + ".cfr", function (err){
	            if (err) throw err;
	            logSpecific("Proceeding with " + uploadedFilePath, req.body.windowKey);
	            callback(uploadedFilePath, uploadedFileDir, urlFile);
	        });
	    });
	};

var logSpecific = function(message, key)
	{
	    var date = new Date();
	    var d = date.toUTCString();

	    if (key != null)
	    {
	        console.log(d + " | " + key + " | " + message);
	    }
	    else 
	        console.log(d + " | " + "GLOBAL" + " | " + message);
	};

var logNormal = function(message)
	{
    	console.log(message);
	};

var killProcessIfExists = function(tool)
	{
		if (tool)
		{
			var pid = tool.pid;
			tool.removeAllListeners();
			logNormal("Killing the process with Parent PID = " + pid);

			// first, try a Windows command
			var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", pid]);

			killer_win.on('error', function (err){	// if error occurs, then we are on Linux
				var killer_linux = spawn("pkill", ["-TERM", "-P", pid]);                   

				killer_linux.on('error', function(err){
					logNormal("Cannot terminate the process.");
				});
			});                
		}
	};

var replaceTemplate = function (input_string, replacement_map)
	{
	    var result = input_string;

	    for (var j = 0; j < replacement_map.length; j++)
	    {
	        result = result.replace(replacement_map[j].needle, replacement_map[j].replacement);
	    }

	    return result;
	};

var replaceTemplateList = function(input_list, replacement_map)
	{
	    var result = new Array();
	    for (var i = 0; i < input_list.length; i++)
	    {
	        result.push(replaceTemplate(input_list[i], replacement_map));
	    }
	    
	    return result;
	};                            

	// filter input command line arguments for safety purposes
var filterArgs = function (argString)
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
	};

var escapeJSON = function (unsafe) 
	{
	    return unsafe.replace(/[\\]/g, '\\\\')
	        .replace(/[\"]/g, '\\\"')
	        .replace(/[\/]/g, '\\/')
	        .replace(/[\b]/g, '\\b')
	        .replace(/[\f]/g, '\\f')
	        .replace(/[\n]/g, '\\n')
	        .replace(/[\r]/g, '\\r')
	        .replace(/[\t]/g, '\\t');
	};

var cleanupOldFiles = function (dir) {
	    logNormal("Cleaning temporary files...");                    
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
	};

var deleteOld = function (path)
	{
		fs.exists(path, function(exists)
	    {
	        if (exists)
	        {
	    		fs.unlink(path, function (err) 
	            { 
	    			if (err)
	                {
	                    logNormal("Could not delete the file: " + path);              
	                    logNormal(err);                 
	                }
	            });
	        }
		});
	}

var finishCleanup = function (dir, results)
	{
		fs.exists(dir, function(exists)
	    {		
	        if (exists)
	        {
	            fs.rmdir(dir, function (err) {
	  		        if (err) 
	                {
	                    logNormal("Could not finish the cleanup: " + dir);
	                    return;
	                }
	                logNormal("Successfully deleted " + dir + " along with contents:\n" + results);
	            });
			}
		});
	}

module.exports.handleUploads = handleUploads;
module.exports.logSpecific = logSpecific;
module.exports.logNormal = logNormal;
module.exports.killProcessIfExists = killProcessIfExists;
module.exports.replaceTemplate = replaceTemplate;
module.exports.replaceTemplateList = replaceTemplateList;
module.exports.cleanupOldFiles = cleanupOldFiles;
module.exports.filterArgs = filterArgs;
module.exports.escapeJSON = escapeJSON;
