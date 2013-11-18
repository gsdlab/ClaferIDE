/*
Copyright (C) 2012 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

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

function CompiledFormats(host)
{ 
    this.id = "mdCompiledFormats";
    this.title = "Compiled Formats";
    
    this.width = (window.parent.innerWidth-30) * (0.24);
    this.height = window.parent.innerHeight - 50 - 245;
    this.posx = (window.parent.innerWidth-30) * 0.38;
    this.posy = 0;
    this.ajaxUrl = "/htmlwrapper";
    
    this.host = host;
    this.goals = null;
    this.model = "The compilation result will be here.";
    this.lastModel = this.model;
}

CompiledFormats.method("onDocLoad", function(){
    if (this.model != "")
    {
        var iframe = $("#html_format")[0];

        if (iframe.contentWindow)
            iframe.contentWindow.document.write(this.model);
        else
            iframe.document.write(this.model);
    }
});

CompiledFormats.method("getInitContent", function()
{
    var result = "";
    result += '<span>Show:</span><select id="formats">';   
    result += '</select>';   
    result += '<div id="format_views">';
    result += '<iframe id="html_format" scrolling="yes" height = "' + (this.height - 30) + '" src="' + this.ajaxUrl + '" frameborder="0" width="' + (this.width - 5) + '"></iframe>';
    result += '</div>';

    return result;

});

CompiledFormats.method("onInitRendered", function()
{
    $("#html_format")[0].onload = this.onDocLoad.bind(this); // do it here.
    $("#formats")[0].onchange = this.onFormatChange.bind(this);        

    var height = (this.height - 35);
    var width = (this.width - 5);

    $.getJSON('/Formats/formats.json', 
        function(data)
        {
            var formats = data.formats;
            var options = "";
            var views = "";
        
            var counter = 0; // need this, because not all formats are displayable

            for (var i = 0; i < formats.length; i++)
            {
                if (formats[i].display_element == "none") // invisible in the view
                {
                    continue;
                }

                if (counter == 0)
                {
                    style = "display:block;";
                }
                else
                {
                    style = "display:none;";                    
                }

                options += '<option value="' + formats[i].id + '">' + formats[i].label + '</option>';
                
                if (formats[i].display_element == "iframe") // all iframes have to be put in advance
                {
                }
                else // textarea
                {
                    style += 'width: ' + (width - 10) + 'px; height: ' + height + 'px;' + 'white-space: nowrap; overflow: auto; resize: none;';
                    views += '<textarea readonly="readonly" id="' + formats[i].id + '_format" height = "' + height+ '" width="' + width + '" style="' + style + '"></textarea>';
                }

                counter++;
            }
            
            $("#formats").html(options);
            $("#format_views textarea").remove();
            $("#format_views").append(views);

        }
    ).error(function() 
        { 
            var options = '<option value="">(Could not load formats)</option>';
            $("#formats").html(options);

        });

});


CompiledFormats.method("onFormatChange", function()
{
    $("#format_views").children().each(function(){
        this.style.display = "none";
    });

    $("#format_views").children("#" + $( "#formats option:selected" ).val() + "_format")[0].style.display = "block";
});
