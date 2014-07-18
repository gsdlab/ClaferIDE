/*
Copyright (C) 2012 - 2014 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

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
function getConfiguration() 
{
	var modules = [];

    modules.push({"name": "Input", "configuration": 
    	{
    		"layout": {
    			"width": (window.parent.innerWidth-40) * 0.38,
    			"height": window.parent.innerHeight-60,
    			"posx": 0,
    			"posy": 0
    		},

    		"title": "Input Clafer Model and Options",
    		"optimization_backend": false, 
            "input_default_cache": "checked",
            "input_default_flags": "-k",    		
            "file_extensions": [
                {
                    "ext": ".cfr", 
                    "button_file_caption": "Compile",
                    "button_example_caption": "Compile",
                    "button_editor_caption": "Compile",

                    "button_file_tooltip": "Compile the Clafer file selected on your machine",
                    "button_example_tooltip": "Compile the example chosen from the example list",
                    "button_editor_tooltip": "Compile the code in the editor below"
                }
            ],
    		"onError": function(module, statusText, response, xhr){
    			return onError(module, statusText, response, xhr);
    		},

    		"onBeginQuery": function(module)
    		{
			    module.host.storage.toReload = module.host.findModule("mdControl").sessionActive; // if there is an active IG session
			    if (module.host.storage.toReload)
			    {
			    	module.host.findModule("mdControl").pausePolling();
			    }

			    return true;
    		},

    		"onFileSent": function(module){
		        module.host.print("ClaferIDE> Processing the submitted model. Compiling...\n");
    		},

    		"onPoll" : function(module, responseObject){
		        if (responseObject.args)
		        {
		            module.host.print("ClaferIDE> clafer " + responseObject.args + "\n");
		        }
    		},
    		"onCompleted" : function(module, responseObject){    			
		        if (responseObject.args)
		        {
		            module.host.print("ClaferIDE> clafer " + responseObject.args + "\n");
		        }

		        if (responseObject.compiled_formats)
		        {
		            module.host.findModule("mdCompiledFormats").setResult(responseObject.compiled_formats);
		        }

		        if (responseObject.model != "")
		        {
		            module.editor.selectAll();
		            module.editor.getSession().replace(module.editor.selection.getRange(), responseObject.model);
		            module.editor.selection.moveCursorTo(0, 0, false);
		            module.editor.selection.clearSelection();
		        }

		        if (responseObject.message == "Success")
		        {
			        module.host.print("Compiler> " + responseObject.message + "\n");
			        module.host.print(responseObject.compiler_message + "\n");    

			        if (module.host.storage.toReload)
			        {
			        	module.host.storage.toReload = false;
			            if (!module.host.findModule("mdControl").reload())
			            {
				            module.host.print("ClaferIDE> No reload command specified for the given backend.\nClaferIDE> Please re-run the backend to work with the changed model.\n");
			            }
			        }
			        else
			        {
			            module.host.findModule("mdControl").resetControls();
			        }
		        }
		        else
		        {
		        	module.host.print("Compiler> Error response:\n" + responseObject.compiler_message + "\n");
		        	console.log(responseObject);
			        if (module.host.storage.toReload)
			        {
						module.host.print("ClaferIDE> The instance generator is still running with the last version of the model.\n");
						module.host.print("ClaferIDE> After you fix the compilation problem, the instance generator will reload.\n");
			        	module.host.findModule("mdControl").resumePolling();
			        }
			        else
			        {
		            	module.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
		            }
		        }		          

		        return true;  
    		}    		
    	}
	});
    modules.push({"name": "CompiledFormats", "configuration": 
    	{
    		"layout": {
    			"width": (window.parent.innerWidth-40) * (0.24),
    			"height": window.parent.innerHeight - 60 - 255,
    			"posx": (window.parent.innerWidth-40) * 0.38,
    			"posy": 0
    		},

	    	"title": "Compiled Formats",
	    	"allow_downloading": true

    	}});

    modules.push({"name": "Control", "configuration": 
    {
    		"layout": {
			    "width": (window.parent.innerWidth-40) * (0.24),
			    "height": 210,
			    "posx": (window.parent.innerWidth-40) * 0.38,
			    "posy": window.parent.innerHeight - 60 - 210
    		},
	    	"title": "Instance Generator",
    		"onError": function(module, statusText, response, xhr)
    		{
    			return onError(module, statusText, response, xhr);
			},
			"onStarted": function (module)
			{
		        module.host.print("ClaferIDE> Running the chosen instance generator...\n");				
			},
			"onStopped": function (module)
			{
				module.host.print("ClaferIDE> Forcing the instance generator to close...\n");				
			},
			"onStart": function (module)
			{
				return true;				
			},
			"onStop": function (module)
			{
				return true;				
			},
			"onDefaultScopeSet": function (module)
			{
				module.host.print("ClaferIDE> Setting the default scope...\n");
			},
			"onAllScopesIncreased": function (module)
			{
				module.host.print("ClaferIDE> Increasing all the scopes...\n");
			},
			"onIndividualScopeSet": function (module)
			{
		        module.host.print("ClaferIDE> Setting the individual scope...\n");
		    },
			"onIndividualScopeIncreased": function (module)
			{
		        module.host.print("ClaferIDE> Increasing the individual scope...\n");
		    },
			"onIntScopeSet": function (module)
			{
		        module.host.print("ClaferIDE> Setting integer bounds...\n");
		    },		    
    		"onPoll" : function(module, responseObject){
				if (responseObject.ig_args != "")
				{
				    module.host.print("ClaferIDE> " + responseObject.ig_args + "\n");
				}				

				if (responseObject.message != "")
				{
				    module.host.print(filterOutput(module.host, responseObject.message));
				}
    		},
    		"onCompleted": function (module, responseObject){
    			module.host.print("ClaferIDE> Instance generator stopped.\n");
    		},
            "onBackendChange": function (module, newBackend)
            {
				module.host.storage.backend = newBackend;            	
			    module.host.findModule("mdControl").disableRuntimeControls();
            },
            "onCustomEvent": function (module, event)
            {
				module.host.print("ClaferIDE> '" + event + "' command sent.\n");
            }

    	}});

    modules.push({"name": "Output", "configuration": 
    	{
	    	"title": "Output",

    		"layout": {
			    "width": (window.parent.innerWidth+65) * 0.38,
			    "height": window.parent.innerHeight-60,
			    "posx": (window.parent.innerWidth-40) * (1 - 0.38),
			    "posy": 0
    		}

    	}});

    var settings = {
    	"onInitialize": function(host)
	    {
	    },
    	"onLoaded": function(host)
	    {
	    	$("#myform").submit();
	    }	    
	};

    return {"modules": modules, "settings": settings};
}

function filterOutput(host, output)
{
	var title = host.storage.backend.presentation_specifics.prompt_title;
	if (title != "")
		return output.replaceAll(title, "");
	
	return output;
}

function onError(module, statusText, response, xhr) 
{
	var currentDate = new Date();
    var errorRecord = {};

    if (statusText == "compile_error")
        errorRecord = {
        	"caption": "Compilation Error", 
    		"body": "Please check whether Clafer Compiler is available, and the model is syntactically correct."
    	};
    else if (statusText == "timeout")
        errorRecord = {
        	"caption": "Request Timeout", 
    		"body": "Please check whether the server is available. You may want to reload the browser page."
    	};
    else if (response && response.responseText == "process_not_found")
        errorRecord = {
        	"caption": "Session not found", 
    		"body": "Looks like your session has been closed due to inactivity. Just recompile your model to start a new session."
    	};
    else if (statusText == "error" && response.responseText == "")
        errorRecord = {
        	"caption": "Request Error", 
    		"body": "Please check whether the server is available. Try to recompile the model or to reload the browser page."
    	};
    else
        errorRecord = {
        	"caption": xhr, 
    		"body": response.responseText
    	};

    errorRecord.datetime = currentDate.today() + " @ " + currentDate.timeNow();
    errorRecord.contact = "If the error persists, please contact Alexandr Murashkin (http://gsd.uwaterloo.ca/amurashk) or Michal Antkiewicz (http://gsd.uwaterloo.ca/mantkiew)";

    module.host.print("ClaferIDE> " + errorRecord.caption + ": " + errorRecord.datetime + "\n" + errorRecord.body + "\n");
    module.host.errorWindow(errorRecord);

    return true;
}