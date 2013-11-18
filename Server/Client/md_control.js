/*
Copyright (C) 2012 Neil Redman <http://gsd.uwaterloo.ca>

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

function Control(host)
{ 
    this.id = "mdControl";
    this.title = "Control";
    
    this.requestTimeout = 60000; // what is the timeout for response after sending a file
    this.pollingTimeout = 60000;  // what is the timeout when polling
    this.pollingDelay = 700;    // how often to send requests (poll) for updates
    this.pollingTimeoutObject = null;
    this.toCancel = false;

    this.width = (window.parent.innerWidth-30) * (0.24);
    this.height = 200;
    this.posx = (window.parent.innerWidth-30) * 0.38;
    this.posy = window.parent.innerHeight - 50 - 200;
    this.host = host;

    this.sessionActive = false;
}

Control.method("getInitContent", function(){
	var ret = '<form id="ControlForm" method="post" action="/control" style="display: block">';
	ret += '<input type="hidden" id="ControlOp" name="operation" value=""/>';
    ret += '<input type="hidden" id="ControlOpArg1" name="operation_arg1" value=""/>';
    ret += '<input type="hidden" id="ControlOpArg2" name="operation_arg2" value=""/>';

    ret += '<select id="backend" name="backend">';       
    ret += '</select>';

    ret += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
	ret += '<input type="button" class="inputRunStopButton" id="RunStop" value="Run" disabled="disabled"/><br>';
    ret += '<fieldset id="backendButtonsFieldset"><div id="backendButtons"></div></fieldset>';

    ret += '<br/><fieldset id="scopeControl">';

    ret += '<legend>Scopes</legend>';   
    ret += '<span>Global:</span><input type="text" size="2" value="1" id="globalScopeValue"/><button id="setGlobalScope">Set</button>';
    ret += '<br/>Individual scopes:</span><br/><input type="text" style="width:190px;" id="individualClafer"></input><input type="text" size="2" id="individualScopeValue"/>';

    ret += '<button id="setIndividualScope">Set</button>';

    ret += '</fieldset>';
   
    ret += '</form>';

    $.getJSON('/Backends/backends.json', 
        function(data)
        {
            var backends = data.backends;
            var options = "";
        
            var backendButtons = "";

            var display = "block";

            for (var i = 0; i < backends.length; i++)
            {
                options += '<option value="' + backends[i].id + '">' + backends[i].label + '</option>';

                backendButtons += '<div id="' + backends[i].id + '_buttons" style="display:' + display + ';">';
                display = "none";

                for (var j = 0; j < backends[i].control_buttons.length; j++)
                {
                    backendButtons += '<button class="control_button" disabled="disabled" id="' + backends[i].id + "-" + backends[i].control_buttons[j].id + '" name="' + backends[i].control_buttons[j].id + '">' + backends[i].control_buttons[j].label + "</button>";
                }

                backendButtons += '</div>';

            }

            $("#backend").html(options);
            $("#backendButtons").html(backendButtons);

            $(".control_button").click(function(){
                $("#ControlOp").val(this.id);
//                return false;
            });

            $("#myform").submit();

        }
    ).error(function() 
        { 
            var options = '<option value="">(Could not load instance generators)</option>';
            $("#backend").html(options);
            $("#myform").submit();

        });

    this.data = "";
    this.error = "";
    this.overwrite = false;

    return ret;
});

Control.method("onInitRendered", function()
{
    $("#backend")[0].onchange = this.onBackendChange.bind(this);        
    $("#RunStop")[0].onclick = this.runStopClick.bind(this);

    $("#setGlobalScope")[0].onclick = this.setGlobalScopeClick.bind(this);
    $("#setIndividualScope")[0].onclick = this.setIndividualScopeClick.bind(this);

    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.showResponse.bind(this);
    options.error = this.handleError.bind(this);
    $('#ControlForm').ajaxForm(options); 
});

Control.method("resetControls", function(){
    $("#RunStop").removeAttr("disabled");
    $("#RunStop").val("Run");
});

Control.method("runStopClick", function(){
    if ($("#RunStop").val() == "Run")
    {
        $("#ControlOp").val("run");
//        $("#backend").attr("disabled", "disabled");
        this.sessionActive = true; // activating IG session
        $("#ControlForm").submit();
    }
    else
    {
        $("#ControlOp").val("stop");
        $("#ControlForm").submit();
    }
});

Control.method("setGlobalScopeClick", function(){
    $("#ControlOp").val("setGlobalScope");
    $("#ControlOpArg1").val($ ("#globalScopeValue").val());
//    $("#ControlForm").submit();
});

Control.method("setIndividualScopeClick", function(){
    $("#ControlOp").val("setIndividualScope");
    $("#ControlOpArg1").val($ ("#individualScopeValue").val());
    $("#ControlOpArg2").val($ ("#individualClafer").val());
//    $("#ControlForm").submit();
});

Control.method("enableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").removeAttr("disabled");
    $("#RunStop").val("Stop");

    $("#setIndividualScope").removeAttr("disabled");
    $("#setGlobalScope").removeAttr("disabled");
    $("#globalScopeValue").removeAttr("disabled");    
    $("#individualScopeValue").removeAttr("disabled");    
});

Control.method("disableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");
    $("#RunStop").val("Run");

    $("#setIndividualScope").attr("disabled", "disabled");
    $("#setGlobalScope").attr("disabled", "disabled");
    $("#globalScopeValue").attr("disabled", "disabled");    
    $("#individualScopeValue").attr("disabled", "disabled");    
});

Control.method("disableAll", function(){
    $("#RunStop").attr("disabled", "disabled");
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");

    $("#setIndividualScope").attr("disabled", "disabled");
    $("#setGlobalScope").attr("disabled", "disabled");
    $("#globalScopeValue").attr("disabled", "disabled");    
    $("#individualScopeValue").attr("disabled", "disabled");    
});

Control.method("beginQuery", function(formData, jqForm, options){
    $("#ControlForm").hide();
});

Control.method("showResponse", function(responseText, statusText, xhr, $form)
{
    if (responseText == "started")
    {        
        this.host.print("ClaferIDE> Running the chosen instance generator...\n");
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay); // start polling
        this.enableRuntimeControls();
    }
    else if (responseText == "stopped")
    {
        this.host.print("ClaferIDE> Forcing the instance generator to close...\n");
    }
    else if (responseText == "global_scope_set")
    {
        this.host.print("ClaferIDE> Setting the global scope...\n");
    }
    else if (responseText == "individual_scope_set")
    {
        this.host.print("ClaferIDE> Setting the individual scope...\n");
    }

    this.endQuery();
});

Control.method("endQuery", function()  { 
    $("#ControlForm").show();
    
    return true;
});

Control.method("handleError", function(response, statusText, xhr)  { 
    clearTimeout(this.pollingTimeoutObject);
    
    this.sessionActive = false;
    
    var er = document.getElementById("error_overlay");
    er.style.display = "block"; 
    var caption;

    if (statusText == "timeout")
        caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";
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


Control.method("onPoll", function(responseObject)
{
//    console.log(responseObject);
    this.processToolResult(responseObject);
    
    if (responseObject.completed)
    {
        this.host.print("ClaferIDE> The instance generator is exited.\n");
        this.disableRuntimeControls();
        this.sessionActive = false;
    }
    else
    {
        if (responseObject.message.length >= 5 && responseObject.message.substring(0,5) == "Error")
        {
        }
        else
        {
            this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
        }
    }
});        

Control.method("poll", function()
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


Control.method("processToolResult", function(result)
{
    if (!result)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }

    if (result.message != "")
    {
        this.host.print(result.message);
    }

});

Control.method("onBackendChange", function()
{
    $("#backendButtons").children().each(function(){
        this.style.display = "none";
    });

    $("#backendButtons").children("#" + $( "#backend option:selected" ).val() + "_buttons")[0].style.display = "block";
});

Control.method("onDataLoaded", function(data){
});
