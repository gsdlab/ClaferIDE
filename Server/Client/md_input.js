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
function Input(host)
{ 
    this.id = "mdInput";
    this.title = "Input File or Example";

    this.requestTimeout = 60000; // what is the timeout for response after sending a file
    this.pollingTimeout = 60000;  // what is the timeout when polling
    this.pollingDelay = 700;    // how often to send requests (poll) for updates
    this.pollingTimeoutObject = null;
    this.toCancel = false;

    this.width = (window.parent.innerWidth-30) * 0.38;
    this.height = window.parent.innerHeight-50;
    this.posx = 0;
    this.posy = 0;
    
    this.host = host;
    this.serverAction = "/upload";
    
    this.dataFileChosen = false;

    this.editor = null;
    this.editorWidth =this.width - 5;
    this.editorHeight = this.height - 83;
}

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

    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.fileSent.bind(this);
    options.error = this.handleError.bind(this);
    options.timeout = this.requestTimeout;

    $('#myform').ajaxForm(options); 

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
	$("#load_area").append('<div id="preloader"><img id="preloader_img" src="/images/preloader.gif" alt="Loading..."/><span id="status_label">Loading and processing...</span><button id="cancel">Cancel</button></div>');	
    $("#cancel").click(this.cancelCall.bind(this));
    this.host.findModule("mdControl").disableAll();

//    this.setClaferModelHTML('<div id="preloader_compiler"><img id="preloader_img" src="/images/preloader.gif" alt="Compiling..."/><span id="status_label">Compiling...</span></div>');

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
//    console.log(responseObject);
    if (responseObject.message === "Exited")
    {
        this.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
    }
    else
    {
        if (responseObject.message != "Working") 
        {
            this.processToolResult(responseObject);
            this.endQuery();
        }

        if (responseObject.message.length >= 5 && responseObject.message.substring(0,5) == "Error")
        {
            this.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
        }
        else if (responseObject.message == "Working")
        {
            this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
        }
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

Input.method("setEditorModel", function(claferText){
    this.editor.setValue(claferText);
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
        this.host.print("ClaferIDE> Processing the submitted model. Compiling...\n");

        var data = new Object();
        data.message = responseText;
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
    var caption;

    if (statusText == "compile_error")
        caption = "<b>Compile Error.</b><br>Please check whether Clafer Compiler is available, and the model is correct.";
    else if (statusText == "timeout")
        caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";
//    else if (statusText == "malformed_output")
//        caption = "<b>Malformed output received from ClaferMoo.</b><br>Please check whether you are using the correct version of ClaferMoo. Also, an unhandled exception is possible.  Please verify your input file: check syntax and integer ranges.";        
//    else if (statusText == "malformed_instance")
//        caption = "<b>Malformed instance data received from ClaferMoo.</b><br>An unhandled exception may have occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.";        
//    else if (statusText == "empty_instances")
//        caption = "<b>No instances returned.</b>Possible reasons:<br><ul><li>No optimal instances, all variants are non-optimal.</li><li>An unhandled exception occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.</li></ul>.";        
//    else if (statusText == "empty_argument")
//        caption = "<b>Empty argument given to processToolResult.</b><br>Please report this error.";        
//    else if (statusText == "empty_instance_file")
//        caption = "<b>No instances found in the specified file.";        
//    else if (statusText == "optimize_first")
//        caption = "<b>You have to run optimization first, and only then add instances.";        
    else if (statusText == "error" && response.responseText == "")
        caption = "<b>Request Error.</b><br>Please check whether the server is available.";        
    else
        caption = '<b>' + xhr + '</b><br>' + response.responseText.replace("\n", "<br>");
    
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
            $("#submitFile").val("Compile");            
        }  
        else{ // unknown file
            $("#submitFile").val("Unknown File");
            $("#submitFile").attr("disabled", "disabled");       
        }
    }
    else{ // no file
        $("#submitFile").attr("disabled", "disabled");       
        $("#submitFile").val("Compile");            
    }
    
});

Input.method("processToolResult", function(result)
{
	if (!result)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }

    if (result.compiled_formats)
    {
        this.host.findModule("mdCompiledFormats").setResult(result.compiled_formats);
    }

    if (result.model != "")
    {
        this.editor.getSession().setValue(result.model);
    }

    if (result.message != "")
    {
        this.host.findModule("mdControl").resetControls();
    }

    this.host.print("Compiler> " + result.message + "\n");
    this.host.print(result.compiler_message + "\n");    

});

Input.method("getInitContent", function()
{
    result = '<div id = "load_area">';
    result += '<form id="myform" action="' + this.serverAction + '" method="post" enctype="multipart/form-data" style="display: block;">';
    result += '<input type="file" size="25" name="claferFile" id="claferFile" style="width: 230px;" title="If you want to upload your clafer file, select one here "/>';
    result += '<input type="hidden" name="claferFileURL" id="claferFileURL" value="' + this.host.claferFileURL + '">';
    result += '<input type="hidden" name="exampleFlag" id="exampleFlag" value="0">';
    result += '<input id="submitFile" type="submit" value="Compile" title="Compile the chosen file with Clafer Compiler">';

    result += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
    result += '<br>';
    result += '<select id="exampleURL" name="exampleURL" style="width: 230px;" title="If you want, you can choose to compile an example clafer model from the list">';   

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
    
    result += '</select>';
    result += '<input id="submitExample" type="submit" value="Compile" title="Compile the chosen example using Clafer Compiler"></input>';
    result += '<div style="display:inline-block"><input id="loadExampleInEditor" type="checkbox" name="loadExampleInEditor" value="unchecked" title="If checked, the editor window below will be loaded with a file or an example submitted">Load in editor below</input></div>';
//    result += '</fieldset>';
//    result += '<br/>';
    result += '<div style="height: 1px; border-bottom: 2px groove threedface"></div>';

    result += 'Or enter your model: <input id="submitText" type="submit" value="Compile" title="Compile the contents of the editor below using Clafer Compiler"/>';

    result += '&nbsp;&nbsp;&nbsp;&nbsp;<div style="display: inline-block; border: 2px groove threedface; float:right">Scope computing: <select id="ss" name="ss" title="Choose a scope computing strategy. Scopes are used for instantiation using bounded model checking">';

    result += '<option value="none" title="Disable scope computing strategy. All scopes are to be set to 1">Disabled</option>';
    result += '<option value="simple" selected="selected" title="Fast computation. Scopes are not precise, but this strategy works in most cases">Fast</option>';
    result += '<option value="full" title="Full computation. This method is very slow, but for small models works relatively fast">Full</option>';

    result += '</select></div>';

    result += '<input id="claferText" name="claferText" type="hidden"/>';

    result += '<div style="height:' + this.editorHeight + 'px; width: ' + this.editorWidth + 'px;" name="clafer_editor" id="clafer_editor">';
    result += '</div>';

    result += '</form></div>';
    
    return result;
// id="addInstances"    
  
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
