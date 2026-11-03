##### ClaferIDE Version 0.5.7, unreleased

Minor release with Clafer 0.5.7.

##### ClaferIDE Version 0.5.6, Nov 1, 2026

Minor release with Clafer 0.5.6.

* New example: a coffee machine with temporal behaviour, in three modeling styles.
* Temporal models run on the Alloy-based instance generator.
* Check button for the Alloy backend: checks the assertions of the model, or those on the given line, and shows a counterexample of each one that fails.
* Diff, Fork and Next Config buttons for the Alloy backend: the changes between instances or states, another trace from a chosen state of a dynamic model, and a trace with another configuration.
* The Diff button can be set before running, and is on by default.
* The view Compiled Formats is now Results: it can show a Solution Graph, which it switches to when a run starts: the latest instance, or the states and transitions of the latest trace (Graphviz), with the changes of each state when Diff is on.
* The tool speaks of a solution generator and solutions, which are instances or traces. The formats' Graph is now Model Graph, which shows the graph instead of its Graphviz source, still available by Download, and the help of the generator lists its buttons.
* The help pages are shown with their styles, images and the title and version of the tool: their paths broke when the tool moved to relative URLs in 0.5.5.

##### ClaferIDE Version 0.5.5, Oct 27, 2026

Minor release with Clafer 0.5.5.

* Models can use decimals, a new primitive type `decimal` with a fixed number of fractional digits, for the Choco-based instance generator (Clafer 0.5.5), e.g., `cost -> decimal = 19.99`; the editor highlights `decimal`. The Alloy-based instance generator shows why it cannot run such a model (ClaferIG 0.5.5).
* Example `Bike.cfr`: a bike with decimal costs and weights.
* The Choco-based backend is described as Choco 6 (chocosolver 0.5.5 uses choco-solver 6.0.2).
* The buttons **URL** and **import** next to the example selector copy the URL of the selected example, to import it into a model elsewhere, and the line `//# OPTIONS --import=Examples/<file>.cfr`, for a model in this tool. Nothing showed the URL of an example. The welcome window, the help and the README explain them.
* The tool can be served under a path behind a reverse proxy, e.g., `https://wiselab.uwaterloo.ca/claferide/` instead of the port 8094, since its pages and requests use relative URLs (ClaferToolsUICommonPlatform). The live demo link points there.

##### ClaferIDE Version 0.5.4, Oct 25, 2026

Minor release with Clafer 0.5.4.

* Models can import other models with `//# OPTIONS --import=...` ([gsdlab/clafer#100](https://github.com/gsdlab/clafer/issues/100)). Since a submitted model may come from anyone, its imports are restricted: only `.cfr` files, local files only from the tool's `Examples` folder (`--import=Examples/<file>.cfr`), and URLs only from public addresses. A model opened with `?claferFileURL=` imports relative to its URL.
* Messages give positions as `model.cfr:line:column` and no longer show the server's folders.
* The welcome window can be closed again: with jQuery 3, its gray backdrop stayed over the page.
* The live demo and model wiki links point to wiselab.uwaterloo.ca.
* [Release](https://github.com/gsdlab/ClaferIDE/pull/19)

##### ClaferIDE Version 0.5.3, Oct 15, 2026

Minor release with Clafer 0.5.3.

* Runs on current Node.js: Express 4 instead of Express 3, with multer for the uploads; `package-lock.json` pins the dependencies.
* Reads the JSON IR of Clafer 0.5.3. Temporal models can be edited and compiled; instance generation is disabled for them, with an explanation in the output.
* The example models set their integer ranges in `//# OPTIONS` (`--minint`, `--maxint`), which silently restricted or emptied their optimal instances before.
* The Choco backend runs the `chocosolver` command from `PATH` instead of a fixed path to `chocosolver.jar`.
* Upgraded client libraries: jQuery 3.7.1, lodash 4.18.1, jquery.form 4.3.0 and d3 3.5.17.
* Hardened server: validated uploads, security headers, size and rate limits, errors without stack traces; models can be opened with `?claferFileURL=` only from the URLs in `allowedModelURLs` (or `ALLOWED_MODEL_URLS`).
* [Release](https://github.com/gsdlab/ClaferIDE/pull/18)

Earlier versions: see the repository's tags.
