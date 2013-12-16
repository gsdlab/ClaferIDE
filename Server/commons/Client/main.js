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
//var mdComparisonTable;
//var mdGoals;
//var mdGraph;
//var mdConsole;
//var mdInput;

var host = null;

$(document).ready(function()
{
    var modules = getConfiguration();    
    
    host = new Host(modules);

    window.onbeforeunload = exitConfirmation;
});

function exitConfirmation() {
    return 'Are you sure you want to quit? ClaferIDE does not save any of results, so you are responsible for saving your results.';
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function Host(modules)
{
    /* GUID for each browser tab */
    /* Note that page refresh is supposed to create a new session */

    var GUID = function () {
                //------------------
                var S4 = function () {
                    return(
                            Math.floor(
                                    Math.random() * 0x10000 /* 65536 */
                                ).toString(16)
                        );
                };
                //------------------

                return (
                        S4() + S4() + "-" +
                        S4() + "-" +
                        S4() + "-" +
                        S4() + "-" +
                        S4() + S4() + S4()
                    );
            };

    this.key = GUID();
    this.claferFileURL = getParameterByName("claferFileURL");
    this.modules = new Array();
    this.configurations = new Array();    
    this.helpGetter = new helpGetter(this);

    for (var i = 0; i < modules.length; i++)
    {
        var MyClass = stringToFunction(modules[i].name);        
        var instance = new MyClass(this, modules[i].configuration);
        
        this.modules.push(instance);
    }    

    for (var i = 0; i < this.modules.length; i++)
    {
        var resize = null;
        
        if (this.modules[i].resize)
        {
            resize = this.modules[i].resize;
        }

        var windowType = "normal";
        
//        if (this.modules[i].iframeType)
//        {
//            windowType = "iframe";
//        }
        
        var x = $.newWindow({
            id: this.modules[i].id,
            title: this.modules[i].title,
            width: this.modules[i].width,
            height: this.modules[i].height,
            posx: this.modules[i].posx,
            posy: this.modules[i].posy,
            content: '',
            type: windowType,
            onDragBegin : null,
            onDragEnd : null,
            onResizeBegin : null,
            onResizeEnd : resize,
            onAjaxContentLoaded : null,
            statusBar: true,
            minimizeButton: true,
            maximizeButton: true,
            closeButton: false,
            draggable: true,
            resizeable: true
        });    
    
//        this.modules[i].window = x;

        if (this.modules[i].getInitContent)
            $.updateWindowContent(this.modules[i].id, this.modules[i].getInitContent());
  
//        if (this.modules[i].iframeType)
//        {
//            $.updateWindowContent(this.modules[i].id, '<iframe id="model" style="height:100%" src="' + this.modules[i].ajaxUrl + '" frameborder="0" width="' + this.modules[i].width + '"></iframe>');
//        }

        if (this.modules[i].onInitRendered)
            this.modules[i].onInitRendered();        

        var helpButton = this.getHelpButton(this.modules[i].id);
        $("#" + this.modules[i].id + " .window-titleBar").append(helpButton);   
    }

    this.print("ClaferIDE> Welcome! Session: " + this.key + "\n");
    
    var displayHelp=getCookie("displayIntroHelp")
    if(displayHelp==null){
        $("body").prepend(this.helpGetter.getInitial());
        this.helpGetter.setListeners();
    }else{
        $("body").prepend(this.helpGetter.getInitial());
        this.helpGetter.setListeners();
        $("#help").hide();
        $(".fadeOverlay").hide();
    }
}

Host.method("print", function(text)
{
    this.findModule("mdOutput").appendConsole(text);
});

//returns the module object. useful for modifying or getting data from other modules.
Host.method("findModule", function(id)
{
    for (var i = 0; i < this.modules.length; i++)
    {
        if (this.modules[i].id == id)
            return this.modules[i];
    }
    
    return null;

});

Host.method("getHelp", function(moduleName){
    this.helpGetter.getHelp(moduleName);
});

Host.method("getHelpButton", function(moduleName){
    return this.helpGetter.getHelpButton(moduleName);
});
