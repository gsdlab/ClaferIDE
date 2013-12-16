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
function Input(host, settings)
{ 
    this.id = "mdInput";
    this.settings = settings;
    this.title = this.settings.title;

    this.requestTimeout = 60000; // what is the timeout for response after sending a file
    this.pollingTimeout = 60000;  // what is the timeout when polling
    this.pollingDelay = 700;    // how often to send requests (poll) for updates
    this.pollingTimeoutObject = null;
    this.toCancel = false;

    this.width = this.settings.layout.width;
    this.height = this.settings.layout.height;
    this.posx = this.settings.layout.posx;
    this.posy = this.settings.layout.posy;
    
    this.host = host;
    this.serverAction = "/upload";
    this.serverOptimizeAction = "/optimize";
    
    this.dataFileChosen = false;

    this.editor = null;
    this.editorWidth = this.width - 5;
    this.editorHeight = this.height - 83;

    this.resize = this.onResize.bind(this);
}

//Input.method("recalculateEditorSize", function()
//{
//    this.editorWidth = this.window.width - 5;
//    this.editorHeight = this.window.height - 83;
//});

Input.method("onInitRendered", function()
{
    this.optimizeFlag = 1;
    this.addInstancesFlag = 1;
    this.previousData = null;
    this.toCancel = false;

    $("#submitFile").click(this.submitFileCall.bind(this));
    $("#submitExample").click(this.submitExampleCall.bind(this));
    $("#submitText").click(this.submitTextCall.bind(this));    
    $("#submitExample").attr("disabled", "disabled");

    $("#submitFile").attr("disabled", "disabled");

    $("#myform [type='file']").change(this.inputChange.bind(this));
    $("#exampleURL").change(this.exampleChange.bind(this));
    $("#loadExampleInEditor").change(this.exampleChange.bind(this));
//    $("#saveSourceButton").click(this.saveSourceCall.bind(this));

    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.fileSent.bind(this);
    options.error = this.handleError.bind(this);
    options.timeout = this.requestTimeout;

    $('#myform').ajaxForm(options); 

//    var options = new Object();
//    options.error = this.handleError.bind(this);
//    options.timeout = this.requestTimeout;

//    $('#optimizeForm').ajaxForm(options); 


//    var optionsForFile = new Object();
//    optionsForFile.success = this.saveSourceSuccess.bind(this);
//    optionsForFile.error = this.handleError.bind(this);
//    optionsForFile.timeout = this.requestTimeout;
//    $('#saveSourceForm').ajaxForm(optionsForFile); 

    this.editor = ace.edit("clafer_editor");
    this.editor.setTheme("ace/theme/eclipse");
    var ClaferMode = require("ace/mode/clafer").Mode;
    this.editor.getSession().setMode(new ClaferMode());
    this.editor.setShowPrintMargin(false);

    // $('#myform').submit(); MOVED TO another location
});

/*
 * Cancel request
 */

Input.method("cancelCall", function() 
{
    $("#cancel").hide();
    $("#status_label").html("Cancelling...");
    this.toCancel = true;
});

/*
 * Shows uploader and hides the form
*/
Input.method("beginQuery", function(formData, jqForm, options) {

    if (this.host.findModule("mdControl").sessionActive) // if there is an active IG session
    {
        alert("Please stop the instance generator and save your results first");
        return false;
    }

	$("#load_area #myform").hide();
	$("#load_area").append('<div id="preloader"><img id="preloader_img" src="/commons/Client/images/preloader.gif" alt="Loading..."/><span id="status_label">Loading and processing...</span><button id="cancel">Cancel</button></div>');	
    $("#cancel").click(this.cancelCall.bind(this));
    this.host.findModule("mdControl").disableAll();

    return true; 
});

// post-submit callback 
Input.method("endQuery", function()  { 
	$("#preloader").remove();
	$("#load_area #myform").show();

    $("#claferFileURL").val(""); // empty the URL
	
	return true;
});

Input.method("onPoll", function(responseObject)
{
    if (!responseObject)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }

    this.settings.onPoll(this, responseObject);

    if (responseObject.message == "Working")
    {
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
    }
    else // finished 
    {   
        this.settings.onCompleted(this, responseObject);
        this.endQuery();
    }
});        

Input.method("poll", function()
{
    var options = new Object();
    options.url = "/poll";
    options.type = "post";
    options.timeout = this.pollingTimeout;
    if (!this.toCancel)
        options.data = {windowKey: this.host.key, command: "ping"};
    else
        options.data = {windowKey: this.host.key, command: "cancel"};
    
    options.success = this.onPoll.bind(this);
    options.error = this.handleError.bind(this);

    $.ajax(options);
});

Input.method("fileSent", function(responseText, statusText, xhr, $form)  { 
    this.toCancel = false;

    if (responseText == "error")
    {
        this.handleError(null, "compile_error", null);
        return;
    }

    if (responseText != "no clafer file submitted")
    {
        this.settings.onFileSent(this);
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
    }
    else
    {
        this.endQuery(); // else enable the form anyways
//        this.setClaferModelHTML(this.host.findModule("mdCompiledFormats").lastModel);
    }
});

Input.method("handleError", function(response, statusText, xhr)  { 
	clearTimeout(this.pollingTimeoutObject);
	var er = document.getElementById("error_overlay");
	er.style.display = "block";	
    var caption = this.settings.onError(this, statusText, response.responseText);
    
	document.getElementById("error_report").innerHTML = ('<span id="close_error" alt="close">Close Message</span><p>' + caption + "</p>");
	document.getElementById("close_error").onclick = function(){ 
		document.getElementById("error_overlay").style.display = "none";
	};
	this.endQuery();
    
});

Input.method("onSubmit", function(){
    if (this.pollingTimeoutObject)
        clearTimeout(this.pollingTimeoutObject);
});

Input.method("submitFileCall", function(){

    $("#exampleURL").val(null);
    $("#exampleFlag").val("0");
    this.onSubmit();
});

Input.method("submitExampleCall", function(){
    $("#exampleFlag").val("1");
    this.onSubmit();
});

Input.method("submitTextCall", function(){
    $("#claferText").val(this.editor.getValue());
    $("#exampleFlag").val("2");
    this.onSubmit();
});

Input.method("exampleChange", function(){
    if ($("#exampleURL").val())
    {
        $("#submitExample").removeAttr("disabled");
    }
    else
    {
 		$("#submitExample").attr("disabled", "disabled");       
    }
});

Input.method("inputChange", function(){
	var filename = $("#myform [type='file']").val();
    
    if (filename)
    {
        if (filename.substring(filename.length-4) == ".cfr"){
            $("#submitFile").removeAttr("disabled");                    
            $("#submitFile").val(this.settings.button_file_caption);            
        }  
        else{ // unknown file
            $("#submitFile").val("Unknown");
            $("#submitFile").attr("disabled", "disabled");       
        }
    }
    else{ // no file
        $("#submitFile").attr("disabled", "disabled");       
        $("#submitFile").val(this.settings.button_file_caption);            
    }
    
});

Input.method("getInitContent", function()
{
    result = '<div id = "load_area" style="height:100%;overflow:hidden">';
    result += '<form id="myform" action="' + this.serverAction + '" method="post" enctype="multipart/form-data" style="display: block; height:100%">';

    result += '<input type="hidden" name="claferFileURL" id="claferFileURL" value="' + this.host.claferFileURL + '">';
    result += '<input type="hidden" name="exampleFlag" id="exampleFlag" value="0">';
    result += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
    result += '<input id="claferText" name="claferText" type="hidden"/>';

    result += '<table width="100%" height="100%" cellspacing="0" cellpadding="0">';    
    result += '<tr height="1em">';
    result += '<td><input type="file" size="20" name="claferFile" id="claferFile" title="If you want to upload your clafer file, select one here "/></td>';
    result += '<td width="60"><input id="submitFile" type="submit" value="' + this.settings.button_file_caption + '" title="' + this.settings.button_file_tooltip + '"/></td>';
    result += '<td width="160"><input id="loadExampleInEditor" type="checkbox" name="loadExampleInEditor" value="unchecked" title="If checked, the editor window below will be loaded with a file or an example submitted">Load into editor</input></td>';
    result += '</tr><tr height="1em">';
    result += '<td><select id="exampleURL" style="width:220px" name="exampleURL" title="If you want, you can choose to compile an example clafer model from the list">';   
    
    result += '</select></td>';
    result += '<td><input id="submitExample" type="submit" value="' + this.settings.button_example_caption + '" title="' + this.settings.button_example_tooltip + '"></input></td>';

    result += '<td style="padding: 0px 2px 0px 2px; border-top: 2px groove threedface; border-left: 2px groove threedface">Scopes: <select id="ss" name="ss" title="Choose a scope computing strategy. Scopes are used for instantiation using bounded model checking">';

    result += '<option value="none" title="Disable scope computing strategy. All scopes are to be set to 1">Disabled</option>';
    result += '<option value="simple" selected="selected" title="Fast computation. Scopes are not precise, but this strategy works in most cases">Fast</option>';
    result += '<option value="full" title="Full computation. This method is very slow, but for small models works relatively fast">Full</option>';

    result += '</select></td>';

    result += '</tr><tr height="1em">';
    result += '<td style="border-top: 2px groove threedface;">';
    result += 'Or enter your model:</td>';
    result += '<td style="border-top: 2px groove threedface; "><input id="submitText" type="submit" value="' + this.settings.button_editor_caption + '" title="' + this.settings.button_editor_tooltip + '"/></td>';

    result += '<td style="padding: 0px 2px 0px 2px;border-left: 2px groove threedface">Flags: <input id="args" type="text" style="width:90px;" name="args" value="-k" title="You can specify any additional compilation flags supported by the compiler"></input></td>';

    var padding = "";
    if (this.settings.optimization_backend)
    {
        padding = 'padding-bottom:35px;';
    }

    result += '</tr><tr height="100%"><td style="height:100%;border-top: 2px groove threedface;' + padding + '" colspan = "3"><div id="clafer_editor" style="height:100%">';

    result += '</div></td>';

    result += '</tr></table>';

    result += '</form>';

    if (this.settings.optimization_backend)
    {
        result += '<div style="position:absolute;bottom:0; left:0;right:0;margin-bottom:-20px;">';
        result += '<div style="height:2px; border-top: 2px groove threedface;"></div>';

        result += 'Optimization backend: <select id="optimizationBackend" style="width:180px" name="optimizationBackend" title=""></select>';

        result += '<input id="useCache" type="checkbox" name="useCache" value="checked">Use Cache</input>';

        result += '</div>';
    }


//    result += '<form id="saveSourceForm" action="/savesource" method="post" enctype="multipart/form-data">';
//    result += '<input type="hidden" name="windowKey" value="' + this.host.key + '"/>';
//    result += '<input type="hidden" name="saveSourceField" id="saveSourceField" value=""></form>';


    $.getJSON('/Examples/examples.json', 
        function(data)
        {
            var examples = data.examples;
            var options = "";
        
            for (var i = 0; i < examples.length; i++)
            {
                var optionClass = 'normal_option';

                if (i == 0)
                    optionClass = 'first_option';

                options += '<option class="' + optionClass + '" value="' + examples[i].url + '">' + examples[i].label + '</option>';
            }
            
            $("#exampleURL").html(options);

        }
    ).error(function() 
        { 
            var optionClass = 'first_option';
            var options = '<option class="' + optionClass + '" value="">Or Choose Example (Could not load examples)</option>';
            $("#exampleURL").html(options);
            
        });

    return result;

});

Input.method("onResize", function() {
    this.editor.resize();
});

function unescapeJSON(escaped) 
{
    return escaped
        .replaceAll('\\\\', '\\')
        .replaceAll('\\"', '"')
        .replaceAll('\\/', '/')
        .replaceAll('\\b', '\b')
        .replaceAll('\\f', '\f')
        .replaceAll('\\n', '\n')
        .replaceAll('\\r', '\r')
        .replaceAll('\\t', '\t');                  
}
