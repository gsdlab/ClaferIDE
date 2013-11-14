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

    this.width = (window.parent.innerWidth-30) / 2;
    this.height = window.parent.innerHeight-50;
    this.posx = 0;
    this.posy = 0;
    
    this.host = host;
    this.serverAction = "/upload";
    
    this.dataFileChosen = false;

    this.editor = null;
    this.editorWidth = ((window.parent.innerWidth-40) / 2) - 10;
    this.editorHeight = window.parent.innerHeight-140;
}

Input.method("onDataLoaded", function(data){
});

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
    this.editor.setTheme("ace/theme/monokai");
    this.editor.getSession().setMode("ace/mode/text");
    this.editor.setShowPrintMargin(false);

    // $('#myform').submit(); MOVED TO md_output.js    
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
	$("#load_area #myform").hide();
	$("#load_area").append('<div id="preloader"><img id="preloader_img" src="/images/preloader.gif" alt="Loading..."/><span id="status_label">Loading and processing...</span><button id="cancel">Cancel</button></div>');	
    $("#cancel").click(this.cancelCall.bind(this));
    this.host.findModule("mdControl").disableAll();

    this.setClaferModelHTML('<div id="preloader_compiler"><img id="preloader_img" src="/images/preloader.gif" alt="Compiling..."/><span id="status_label">Compiling...</span></div>');

    return true; 
});

// post-submit callback 
Input.method("endQuery", function()  { 
	$("#preloader").remove();
	$("#load_area #myform").show();
	
	return true;
});

/* Not used. We don't need it anymore
// pre-submit callback 
Input.method("showRequest", function(formData, jqForm, options) {
    var queryString = $.param(formData); 
    return true; 
});
*/

Input.method("onPoll", function(responseObject)
{
//    console.log(responseObject);
    if (responseObject.message === "Exited")
    {
        this.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
    }
    else
    {
        this.processToolResult(responseObject);

        if (responseObject.message.length >= 5 && responseObject.message.substring(0,5) == "Error")
        {
            this.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
            // stop polling
        }
        else if (responseObject.message != "Success")
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

Input.method("setClaferModelHTML", function(html){
    this.host.findModule("mdClaferModel").lastModel = this.host.findModule("mdClaferModel").model;
    this.host.findModule("mdClaferModel").model = html;
    var iframe = $("#html_format")[0];
    iframe.src = iframe.src; // reloads the window
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
        $("#output").html($("#output").html() + "===============\n");
        var data = new Object();
        data.message = responseText;
        this.host.updateData(data);
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
    }
    else
    {
        this.endQuery(); // else enable the form anyways
        this.setClaferModelHTML(this.host.findModule("mdClaferModel").lastModel);
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
        }  
        else{ // unknown file
            $("#submitFile").val("Unknown File");
            $("#submitFile").attr("disabled", "disabled");       
        }
    }
    else{ // no file
        $("#submitFile").attr("disabled", "disabled");       
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
        for (var i = 0; i < result.compiled_formats.length; i++)
        {
            if (result.compiled_formats[i].id == "html")
            {
                this.setClaferModelHTML(result.compiled_formats[i].result);         
            }
            else // textarea
            {
                $("#" + result.compiled_formats[i].id + "_format").val(result.compiled_formats[i].result); 
            }
        }
        
        this.endQuery();
    }

//    if (result.html)
//    {
//        this.setClaferModelHTML(result.html);        
//        // when we receive first HTML, it means our model is compiled, and we show the input form again
//        this.endQuery();
//    }

    if (result.model != "")
    {
        this.editor.getSession().setValue(result.model);
    }

    if (result.message != "")
    {
        this.host.findModule("mdControl").resetControls();
    }

    $("#output").html($("#output").html() + result.message.replaceAll("claferIG> ", "ClaferIG>\n"));

});

Input.method("getInitContent", function()
{
    result = '<div id = "load_area">';
    result += '<form id="myform" action="' + this.serverAction + '" method="post" enctype="multipart/form-data" style="display: block;">';
    result += '<fieldset>';
    result += '<input type="file" size="25" name="claferFile" id="claferFile" style="width: 388px;">';
    result += '<input type="hidden" name="claferFileURL" value="' + window.location + '">';
    result += '<input type="hidden" name="exampleFlag" id="exampleFlag" value="0">';
    result += '<input id="submitFile" type="submit" value="Compile">';

    result += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
    result += '<br>';
    result += '<select id="exampleURL" name="exampleURL" style="width: 388px;">';   

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
    result += '<input id="submitExample" type="submit" value="Compile"></input>';
    result += '<input id="loadExampleInEditor" type="checkbox" name="loadExampleInEditor" value="unchecked">load in editor</input>';
    result += '</fieldset><div style="height:8px">&nbsp;</div>';

    result += 'Or enter your model below: <input id="submitText" type="submit" value="Compile"/>';
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
