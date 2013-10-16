ClaferIDE
===================

v0.3.5.??-??-????

A web-based IDE for Clafer.

ClaferMooVisualizer is part of Clafer Tools. 
Read more in the paper [Clafer Tools for Product Line Engineering](http://gsd.uwaterloo.ca/publications/view/519).

### Live demo

[Try me!](http://t3-necsis.cs.uwaterloo.ca:8094/)

If the demo is down or you encounter a bug, please email [Michal Antkiewicz](mailto:mantkiew@gsd.uwaterloo.ca).

### Background

[Clafer](http://clafer.org) is a general-purpose lightweight structural modeling language developed at [GSD Lab](http://gsd.uwaterloo.ca/), [University of Waterloo](http://uwaterloo.ca). 
Clafer can be used for *product-line modeling* and *multi-objective optimization*, whereby a the model of a product line can be used to find optimal products given a set of optimization goals. 

### Functions

1. 

### Nature

ClaferIDE is a web-based application. 
Its server side (implemented with Node.JS) processes requests, runs the chosen back-end and passes back its output.
The client-side is implemented using Javascript/HTML and handles all the visualization and exploration functionality.

Contributors
------------

* [Alexandr Murashkin](http://gsd.uwaterloo.ca/amurashk), MMath Candidate. Main developer.
* [Michał Antkiewicz](http://gsd.uwaterloo.ca/mantkiew), Research Engineer. Requirements, development, architecture, testing, technology transfer.

Getting Clafer Tools
--------------------

Binary distributions of release 0.3.5 of 
Clafer, 
ClaferIG,
ClaferIDE, 
ClaferWiki, 
ClaferMoo, 
ClaferMooVisualizer, 
and ClaferConfigurator 
for Windows, Mac, and Linux, 
can be downloaded from [Clafer Tools - Binary Distributions](http://gsd.uwaterloo.ca/node/516). 
Clafer Wiki requires Haskell Platform and MinGW to run on Windows. 

In case these binaries do not work on your particular machine configuration, the tools can be easily built from source code, as described below.

### Dependencies for running

* [Java Platform (JDK)](http://www.oracle.com/technetwork/java/javase/downloads/index.html) v6+, 32bit
* [Clafer](https://github.com/gsdlab/clafer) v0.3.5
  * can be from the binary distribution
* [ClaferIG](https://github.com/gsdlab/claferIG) v0.3.5
* [Node.JS Framework](http://nodejs.org/download/), v0.10.18

### Installation

Core
--------------------

1. Download [ClaferIDE](https://github.com/gsdlab/claferIDE) to some directory `<target directory>`
2. Go to `<target directory>/ClaferIDE/Server` and execute
	
 `npm install`

3. Install the necessary backends using the steps below.

### Important: Branches must correspond

Clafer, ClaferIG, ClaferIDE, ClaferWiki, ClaferMoo,  ClaferMooVisualizer, and ClaferConfigurator are following the *simultaneous release model*. 
The branch `master` contains releases, whereas the branch `develop` contains code under development. 
When building the tools, the branches should match:
Releases `clafer/master` and `claferIG/master` are guaranteed to work well together.
Development versions `clafer/develop` and `claferIG/develop` should work well together but this might not always be the case.

### Settings

1. Make sure the port `8094` is free, or change the value of the key `port` in `Server/config.json`:
`"port" = "8094"` to any free one. 

2. Make sure `clafer`, `claferIG`, `node`, and `java` are in `PATH` environment variables, so they can be executed without any path prefixes.

Running the following commands should produce the following results or later version:

`clafer -V` 

> `Clafer v0.3.5.??-??-????`

`claferIG -V` 

> `Clafer v0.3.5.??-??-????`

`java -version`

> `java version 1.7.0_25`

`node -v`

>v0.10.18

3. Make sure `uploads` folder is accessible for writing, since temporary files will be stored there.

### Running

To run the server execute
	
`node server.js`
 
from `<target directory>/ClaferIDE/Server/`

Then you can go to any browser and type `http://localhost:[port]/` and open any Clafer file with objectives in it.

Need help?
==========
* See [Project's website](http://gsd.uwaterloo.ca/clafer) for news, technical reports and more
  * Check out a [Clafer tutorial](http://gsd.uwaterloo.ca/node/310)
  * Try live instance of [ClaferWiki](http://t3-necsis.cs.uwaterloo.ca:8091)
* Take a look at incomplete [Clafer wiki](https://github.com/gsdlab/clafer/wiki)
* Browse example models in the [test suite](https://github.com/gsdlab/clafer/tree/master/test/positive) and [MOO examples](https://github.com/gsdlab/clafer/tree/master/spl_configurator/dataset)
* Post questions, report bugs, suggest improvements [GSD Lab Bug Tracker](http://gsd.uwaterloo.ca:8888/questions/). Tag your entries with `clafermooviz` (so that we know what they are related to) and with `alexander-murashkin` or `michal` (so that Alex or Michał gets a notification).
