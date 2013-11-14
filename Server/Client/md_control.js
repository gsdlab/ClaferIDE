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
    
    $.getJSON('/Backends/backends.json', 
        function(data)
        {
            var backends = data.backends;
            var options = "";
        
            for (var i = 0; i < backends.length; i++)
            {
                options += '<option value="' + backends[i].id + '">' + backends[i].label + '</option>';
            }
            
            $("#backend").html(options);
            $("#myform").submit();

        }
    ).error(function() 
        { 
            var options = '<option value="">(Could not load instance generators)</option>';
            $("#backend").html(options);
            $("#myform").submit();

        });
    
    ret += '</select>';

    ret += '<input type="hidden" id="windowKey" name="windowKey" value="' + this.host.key + '">';
	ret += '<input type="button" class="inputRunStopButton" id="RunStop" value="Run" disabled="disabled"/><br>';
    ret += '<input type="button" class="inputNextButton" id="Next" value="Next Instance" disabled="disabled"/><br>';

    this.data = "";
    this.error = "";
    this.overwrite = false;

    return ret;
});

Control.method("onInitRendered", function()
{
    $("#RunStop").click(function(){
        $("#ControlOp").val("runstop");
        $("#ControlForm").submit();
    });

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

Control.method("enableAll", function(){
    $("#Next").removeAttr("disabled");
    $("#RunStop").removeAttr("disabled");
    $("#RunStop").val("Stop");
});

Control.method("disableAll", function(){
    $("#Next").attr("disabled", "disabled");
    $("#RunStop").attr("disabled", "disabled");
});

Control.method("onDataLoaded", function(data){
});

Control.method("beginQuery", function(formData, jqForm, options){
    $("#ControlForm").hide();
});

Control.method("showResponse", function(responseText, statusText, xhr, $form)
{
    $("#ControlForm").show();
});

Control.method("handleError", function(responseText, statusText, xhr, $form){
    $("#ControlForm").show();
});