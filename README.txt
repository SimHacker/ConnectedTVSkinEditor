This is the ConnectedTV Skin Editor, written by Don Hopkins
(dhopkins@DonHopkins.com). 

To run it, double click on the file "Editor\Editor.hta".

ConnectedTV is Palm application that turns you PDA into a universal IR
remote control integrated with a personalized TV guide. 

ConnectedTV skins used for control panels, help pages, program guide
browsers, grid views, as well as custom remote control interfaces
tailored to particular consumer electronic devices (like TV, CD, DVD,
TiVo, etc). So we needed to create and edit many different user
interface layouts, which are defined as XML files and images, and
compiled into "PDB" files for the Palm.

The ConnectedTV Skin Editor is a desktop HTML application written in
JavaScript, which runs as an "HTA" application (which gives it
priviliges to read and write files, use ActiveX controls, etc).  It
only runs in Internet Explorer, so it makes no effort to support
multiple browsers, and uses several ActiveX components and other
IE-specific features.

It visually simulates the Palm ConnectedTV application, and lets you
preview and edit user interface layouts, using direct manipulation,
drag and drop, pie menus and XML Schema driven propety sheets. It
reads, writes and edits the ConnectedTV XML file formats, based on an
XML Schema that describes their properties, constraints and
relationships. 

It has a JavaScript library including classes that read and
understands the XML Schema, plus an XML based XHTML Template system,
and also an automatic property sheet editor GUI Generator,
based on the Schema and Template classes.

It uses a binary ActiveX rendering control (ConnectedSkin.dll) to
efficiently display the resizable ConnectedTV button skin bitmaps, and
also DHTML Behavior Components writting in JavaScript including pie
menus (piemenu.htc), window resize stretchers (stretcher.htc) and
command buttons (CommandButton.htc). It uses the standard
"Scripting.FileSystemObject" ActiveX control to read and write local
files, and the standard "Microsoft.XMLDOM" xml parser ActiveX control
to read and parse XML files.

Directories and Files:

Skins
  This directory contains the XML and image files for the various
  skins, including sub-directories for Images and XML, and Palm
  resource file definitions and build scripts.

Editor
  This directory contains the ConnectedTV Skin Editor.

Editor/Editor.hta
  This file is the "HyperText Application", which is a web page that
  runs with normal desktop priviliges. It loads the JavaScript and
  kicks off the application.

Editor/Images
  Images used by skin editor.

Editor/XML
  XML used by skin editor.

Editor/XML/ConnectedTVSchema-1.0.xsd
  XML Schema for ConnectedTV Skin Editor, including metadata for editor application and templates for HTML generation.
  Lots of good stuff in here.

Editor/XML/Skins.xml
  XML list of all skins and where they are.

Editor/Resources
  This directory contains the Components, Images and XML. 

Editor/Resources/Components
  This directory contains the software components of the application,
  including JavaScript and binary components.

Editor/Resources/Components/EditorMain.js
  This file contains the main application source code written in JavaScript. 
  Lots of good stuff in here.

Editor/Resources/Components/piemenu.htc
  This file contains the pie menus, a DHTML Component written in XML/JavaScript.

Editor/Resources/Components/testpie.html
  Pie menu component test page.

Editor/Resources/Components/CommandButton.htc
  This file contains the command button, a DHTML Component written in XML/JavaScript.

Editor/Resources/Components/stretcher.htc
  This file contains the stretcher, a DHTML Component written in XML/JavaScript.

Editor/Resources/Components/ConnectedSkin.dll
  This file contains the ConnectedSkin rendering component, a binary ActiveX Behavior Component written in C++.

Editor/Resources/Components/ConnectedSkin.htm
  ConnectedSkin component test page.

Editor/Resources/Components/StretchButton.bmp
  This file contains a stretchable button used by ConnectedSkin.htm to test ConnectedSkin.dll.

