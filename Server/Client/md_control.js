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

    this.width = (window.parent.innerWidth-30) / 4;
    this.height = 100;
    this.posx = (window.parent.innerWidth-30) * 3 / 4;
    this.posy = 0;
    this.host = host;
}

Control.method("getInitContent", function(){
	var ret = '<form id="ControlForm" method="post" action="/control" style="display: block">';
	ret += '<input type="hidden" id="ControlOp" name="operation" value="">';

    ret += '<span>Instance Generators:</span><select id="backend" name="backend">';   
    
    ret += '</select>';

    ret += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
	ret += '<input type="button" class="inputRunStopButton" id="RunStop" value="Run" disabled="disabled"/><br>';
    ret += '<div id="backendButtons"></div>';

    
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
                    backendButtons += '<button disabled="disabled" id="' + backends[i].id + '" name="' + backends[i].control_buttons[j].id + '">' + backends[i].control_buttons[j].label + "</button>";
                }

                backendButtons += '</div>';

            }
            
            $("#backend").html(options);
            $("#backendButtons").html(backendButtons);
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

    $("#Next").click(function(){
        $("#ControlOp").val("next");
        $("#ControlForm").submit();
    });

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
        $("#RunStop").val("Stop");
        $("#backend").attr("disabled", "disabled");
        this.enableRuntimeControls();
        $("#ControlForm").submit();
    }
    else
    {
        $("#ControlOp").val("stop");
        $("#RunStop").val("Run");
        $("#backend").removeAttr("disabled");
        this.disableRuntimeControls();
        $("#ControlForm").submit();
    }
});

Control.method("enableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").removeAttr("disabled");
});

Control.method("disableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");
});

Control.method("disableAll", function(){
    $("#RunStop").attr("disabled", "disabled");
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");
});


Control.method("onDataLoaded", function(data){
});

Control.method("beginQuery", function(formData, jqForm, options){
    $("#ControlForm").hide();
});

Control.method("showResponse", function(responseText, statusText, xhr, $form)
{
    this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay); // start polling
    $("#ControlForm").show();
});

Control.method("handleError", function(responseText, statusText, xhr, $form){
    $("#ControlForm").show();
});


Control.method("onPoll", function(responseObject)
{
//    console.log(responseObject);
    this.processToolResult(responseObject);
    
    if (responseObject.completed)
    {
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

    $("#output").html($("#output").html() + result.message.replaceAll("claferIG> ", "ClaferIG>\n"));

});

Control.method("onBackendChange", function()
{
    $("#backendButtons").children().each(function(){
        this.style.display = "none";
    });

    $("#backendButtons").children("#" + $( "#backend option:selected" ).val() + "_buttons")[0].style.display = "block";
});
