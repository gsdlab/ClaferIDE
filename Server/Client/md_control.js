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

function Control(host, settings)
{ 
    this.id = "mdControl";
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

    this.sessionActive = false;
}

Control.method("getInitContent", function(){
	var ret = '<form id="ControlForm" method="post" action="/control" style="display: block">';
	ret += '<input type="hidden" id="ControlOp" name="operation" value=""/>';
    ret += '<input type="hidden" id="ControlOpArg1" name="operation_arg1" value=""/>';
    ret += '<input type="hidden" id="ControlOpArg2" name="operation_arg2" value=""/>';

    ret += '<select id="backend" name="backend" title="Choose an instance generator backend">';       
    ret += '</select>';

    ret += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
	ret += '<input type="button" class="inputRunStopButton" id="RunStop" value="Run" disabled="disabled"/><br>';
    ret += '<fieldset id="backendButtonsFieldset"><div id="backendButtons"></div></fieldset>';

    ret += '<div style="height:5px;"></div><fieldset id="scopeControl">';

    ret += '<legend>Scope Settings</legend>';  
    ret += '<table width="100%" border="0" cellspacing="0" cellpadding="0">'; 

    var saveLink = '<td></td>';
//    var saveLink = '<td style="padding-right:5px" align="right"><a href="">Download scopes</a></td>';

    ret += '<tr><td style="padding-left:5px">Default:</td><td><input type="text" class="scopeInput" title="Enter the scope (an integer from 0 up to a number the backend can handle)" size="2" value="1" id="globalScopeValue"/><button id="setGlobalScope" title="Set the global (or default) scope">Set</button></td>' + saveLink + '</tr>';
    ret += '<tr><td style="padding-left:5px">Integers:</td><td colspan="2"><input type="text" class="scopeInput" size="2" value="-128" id="intLowScopeValue" title="Enter the lower bound for unknown integers (can be negative)"/> to <input type="text" class="scopeInput" size="2" value="127" id="intHighScopeValue" title="Enter the upper bound for unknown integers (normally positive)"/><button id="setIntScope" title="Set the selected scope for integers">Set</button></td></tr>';
    ret += '<tr><td style="padding-left:5px">Clafers:</td><td colspan="2"><input type="text" style="width:120px;" id="individualClafer" placeholder="Clafer name(s)" title="Enter the clafer name, namespace, path or choose ones from a drop down, depending on the backend"></input>';

    ret += '<span id="ClaferListCont" style="width:30px"></span>';
    ret += '<input type="text" size="2" value="1" class="scopeInput" id="individualScopeValue" title="Enter the scope value (an integer from 0 up to a number the backend can handle)"/>';

    ret += '<button id="setIndividualScope" title="Set the scope of the specified clafer(s)">Set</button></td></tr>';    
    ret += '</table>';
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
                options += '<option value="' + backends[i].id + '" title="' + backends[i].tooltip + '">' + backends[i].label + '</option>';

                backendButtons += '<div id="' + backends[i].id + '_buttons" style="display:' + display + ';">';
                display = "none";

                for (var j = 0; j < backends[i].control_buttons.length; j++)
                {
                    backendButtons += '<button class="control_button" disabled="disabled" id="' + backends[i].id + "-" + backends[i].control_buttons[j].id + '" name="' + backends[i].control_buttons[j].id + '" title="' + backends[i].control_buttons[j].tooltip + '">' + backends[i].control_buttons[j].label + "</button>";
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
    $("#setIntScope")[0].onclick = this.setIntScopeClick.bind(this);

    var options = new Object();
    options.beforeSubmit = this.beginQuery.bind(this);
    options.success = this.showResponse.bind(this);
    options.error = this.handleError.bind(this);
    $('#ControlForm').ajaxForm(options); 

});

Control.method("resetControls", function(){
    $("#RunStop").removeAttr("disabled");
    $("#RunStop").val("Run");
    $("#RunStop").attr("title", "Run the selected backend");
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

Control.method("setIntScopeClick", function(){
    $("#ControlOp").val("setIntScope");
    $("#ControlOpArg1").val($ ("#intLowScopeValue").val());
    $("#ControlOpArg2").val($ ("#intHighScopeValue").val());
//    $("#ControlForm").submit();
});

Control.method("enableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").removeAttr("disabled");
    $("#RunStop").val("Stop");
    $("#RunStop").attr("title", "Force the running backend to stop");

    $("#setIndividualScope").removeAttr("disabled");
    $("#setGlobalScope").removeAttr("disabled");
    $("#globalScopeValue").removeAttr("disabled");    
    $("#individualScopeValue").removeAttr("disabled");    
    $("#individualClafer").removeAttr("disabled");   

    $("#intLowScopeValue").removeAttr("disabled");    
    $("#intHighScopeValue").removeAttr("disabled");   
    $("#setIntScope").removeAttr("disabled");   

});

Control.method("disableRuntimeControls", function(){
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");
    $("#RunStop").val("Run");
    $("#RunStop").attr("title", "Run the selected backend");

    $("#setIndividualScope").attr("disabled", "disabled");
    $("#setGlobalScope").attr("disabled", "disabled");
    $("#globalScopeValue").attr("disabled", "disabled");    
    $("#individualScopeValue").attr("disabled", "disabled");    
    $("#individualClafer").attr("disabled", "disabled");    

    $("#intLowScopeValue").attr("disabled", "disabled");    
    $("#intHighScopeValue").attr("disabled", "disabled");   
    $("#setIntScope").attr("disabled", "disabled");   

});

Control.method("disableAll", function(){
    $("#RunStop").attr("disabled", "disabled");
    $("#" + $( "#backend option:selected" ).val() + "_buttons").children("button").attr("disabled", "disabled");

    $("#setIndividualScope").attr("disabled", "disabled");
    $("#setGlobalScope").attr("disabled", "disabled");
    $("#globalScopeValue").attr("disabled", "disabled");    
    $("#individualScopeValue").attr("disabled", "disabled");    
    $("#individualClafer").attr("disabled", "disabled");    

    $("#intLowScopeValue").attr("disabled", "disabled");    
    $("#intHighScopeValue").attr("disabled", "disabled");   
    $("#setIntScope").attr("disabled", "disabled");   
});

Control.method("beginQuery", function(formData, jqForm, options){
    $("#ControlForm").hide();
});

Control.method("showResponse", function(responseText, statusText, xhr, $form)
{
    if (responseText == "started")
    {   
        this.settings.onStarted(this);
        this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay); // start polling
        this.enableRuntimeControls();
    }
    else if (responseText == "stopped")
    {
        this.settings.onStopped(this);
    }
    else if (responseText == "global_scope_set")
    {
        this.settings.onGlobalScopeSet(this);
    }
    else if (responseText == "individual_scope_set")
    {
        this.settings.onClaferScopeSet(this);
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
    var caption = this.settings.onError(this, statusText, response.responseText);

    document.getElementById("error_report").innerHTML = ('<span id="close_error" alt="close">Close Message</span><p>' + caption + "</p>");
    document.getElementById("close_error").onclick = function(){ 
        document.getElementById("error_overlay").style.display = "none";
    };

    this.endQuery();
    
});


Control.method("onPoll", function(responseObject)
{
//    console.log(responseObject);
    if (!responseObject)
    {
        this.handleError(null, "empty_argument", null);
        return;
    }

    if (responseObject.scopes != "")
    {
        this.updateClaferList(JSON.parse(responseObject.scopes));    
    }

    this.settings.onPoll(this, responseObject);
    
    if (responseObject.completed)
    {
        this.settings.onCompleted(this, responseObject);
        this.disableRuntimeControls();
        this.sessionActive = false;
    }
    else
    {
//        if (responseObject.message.length >= 5 && responseObject.message.substring(0,5) == "Error")
//        {
//        }
//        else
//        {
            this.pollingTimeoutObject = setTimeout(this.poll.bind(this), this.pollingDelay);
//        }
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

Control.method("updateClaferList", function(jsonList){


//$( "#backend option:selected" ).val()

    var options = "";

    if (!jsonList.list)
        return;

    for (var i = 0; i < jsonList.list.length; i++)
    {
        var hierarchy = "";
        if (jsonList.list[i].hierarchy)
            hierarchy = " [" + jsonList.list[i].hierarchy + "]";

        options += '<option value="' + jsonList.list[i].name + "|" + jsonList.list[i].value + '">' + jsonList.list[i].name + ": " + jsonList.list[i].value + "" + hierarchy + '</option>';
    }

    $("#ClaferListCont").html('<select id="ClaferList"></select>');
    $("#ClaferList").html(options);

    $('#ClaferList').on('change', function(event, params) {
        var s = params.selected;
        var parts = s.split("|");
        $('#individualClafer').val(parts[0]);
        $('#individualScopeValue').val(parts[1]);
        $('#individualScopeValue').focus();
        $('#individualScopeValue').select();
    });

    $('#ClaferList').chosen({"search_contains": "true", "width": "30px"});

    var left = this.posx + "px";
    var top = 0 + "px";

    var height = this.host.findModule("mdCompiledFormats").height + "px";
    var width = this.host.findModule("mdCompiledFormats").width + "px";

    $("#ClaferListCont .chosen-drop")[0].style.left = left;    
    $("#ClaferListCont .chosen-drop")[0].style.top = top;    
    $("#ClaferListCont .chosen-drop")[0].style.width = width;    
    $("#ClaferListCont .chosen-results")[0].style.maxHeight = height;    

});

Control.method("onBackendChange", function()
{
    $("#backendButtons").children().each(function(){
        this.style.display = "none";
    });

    var selectedId = $( "#backend option:selected" ).val();

    $("#backendButtons").children("#" + selectedId + "_buttons")[0].style.display = "block";
});
