////////////////////////////////////////////////////////////////////////
//
// ConnectedTV User Interface Editor.
//
// Copyright (C) 2003 by ConnectedMedia.
// All rights reserved.
//
// Architecture and implemention by Don Hopkins.
// For more information, please visit: http://www.Connected.TV
//
////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////
// Globals


var Title = ApplicationTag.applicationName;
var Version = ApplicationTag.version;
var Copyright = "Copyright (C) 2003 by ConnectedMedia. All rights reserved.";
var CopyrightComment = "<!-- " + Copyright + " -->";

var TitleVersion = Title + " " + Version;
document.title = TitleVersion;
TitleVersionSpan.innerText = TitleVersion;

var EditorBaseRelative = "..";
var EditorBase = null;

var SchemaURL = "Resources/XML/ConnectedTVSchema-1.0.xsd";

var SkinsURL = "Resources/XML/Skins.xml";
var Skins = new Array();

var ObjectDict = new Object();
var EventSource = null;

var CurrentResource = null;
var CurrentSkin = null;
var CurrentGui = null;
var CurrentButton = null;
var CurrentCell = null;

var WindowWidth = 1024;
var WindowHeight = 1024;
var LoadError = 0;
var ViewScale = 2;
var BlackAndWhite = 1;
var PieStrokeDistance = 12;
var CurrentEditor = "Help";
var NextEditor = null;
var ButtonTool = "Pen";
var NextButtonTool = null;
var DisableResources = 0;
var EnableWriting = 0;
var RepairTimer = null;
var RepairDelay = 10;
var SelectEditorDelay = 10;
var CurrentEditorType = "";
var SaveEnabled = 1;
var XRayMode = 0;

var XMLResourceIDBase = 5000;
var GuiResourceIDBase = 6000;
var ImageResourceIDBase = 8000;

// Pie menu states.
var pieSliceTouch = 0;
var pieSliceTap = 1;
var pieSliceUp = 2;
var pieSliceDown = 3;
var pieSliceLeft = 4;
var pieSliceRight = 5;


////////////////////////////////////////////////////////////////////////
// ActiveX Objects


// The File System Object gives us access to the local file system.
var ForReading = 1;
var ForWriting = 2;
var ForAppending = 8;
var FileSystem = new ActiveXObject("Scripting.FileSystemObject");

// The XMLHTTP Object gives us access to remote XML files via HTTP.
//var XMLHTTP = new ActiveXObject("Microsoft.XMLHTTP");


////////////////////////////////////////////////////////////////////////
// Global data, loaded from the Application_Globals template.


var CommandNames = [];
var SourceNames = [];
var FontNames = [];
var ColorNames = [];
var DeviceNames = [];
var EditorNames = [];


////////////////////////////////////////////////////////////////////////
// Application Startup


function DoLoadPage()
{
  window.resizeTo(
    WindowWidth, 
    WindowHeight);

  if ((!Schema.LoadSchemasFromURL(
          SchemaURL)) ||
      (!LoadGlobals()) ||
      (!LoadRoot()) ||
      (!MakeMenus()) ||
      (!Skin.LoadSkinsFromURL(
          SkinsURL)) ||
      (!Gui.GotoGui(
          "Home")) ||
      (!SelectEditor(
          CurrentEditor)) ||
      LoadError) {
    Notice.style.border = "red dashed 4";
    Notice.innerHTML += "<BR/>Load Error: " + LoadError + "<BR/>";
    return false;
  } // if

  Notice.style.top = 0;
  Notice.style.height = "100%";

  return true;
}


function DoUnloadPage()
{
  return true;
}


function DoBeforeUnloadPage()
{
  if (SaveEnabled) {
    var gui = GetCurrentGui();
    if (gui != null) {
      gui.AskSave();
    } // if
  } // if
  Gui.ClearCurrentGui();

  return true;
}


////////////////////////////////////////////////////////////////////////
// Class SchemaAttributeEnumeration


function SchemaAttributeEnumeration(element)
{
  this.el = element;
  this.value = GetAttStr(element, "value", "");
  this.documentation = GetElementStr(element, "./annotation/documentation", "");

  return this;
}


////////////////////////////////////////////////////////////////////////
// Class SchemaAttribute


function SchemaAttribute(element)
{
  this.el = element;
  this.name = GetAttStr(element, "name", "");
  this.type = GetAttStr(element, "type", "");
  this.edittypes = GetAttStr(element, "ctv:edittypes", "").split(",");
  this.edittypeindex = 0;
  this.init = GetAttStr(element, "ctv:init", "");
  this.label = GetAttStr(element, "ctv:label", "");
  this.documentation = GetElementStr(element, "./annotation/documentation", "");
  var enumerations = new Array()
  this.enumerations = enumerations;

  var kid = element.firstChild;
  while (kid != null) {
    if (kid.nodeType == 1) {
      var nodename = kid.nodeName;
      if (nodename == "enumeration") {
        var enumer =
            new SchemaAttributeEnumeration(kid);
        enumerations[enumerations.length] = enumer;
      } // if
    } // if
    kid = kid.nextSibling;
  } // while
}


SchemaAttribute.prototype.GetValueLabel = function(val)
{
  var label = "" + val;
  var type = this.type;
  var enumerations = this.enumerations;

  if ((this.type == 'int') &&
      (enumerations != null) &&
      (enumerations.length > 0)) {
    var n = enumerations.length;
    var i;
    for (i = 0; i < n; i++) {
      var enumer = enumerations[i];
      if (enumer.value == label) {
        label = enumer.value + ": " + enumer.documentation
        break;
      } // if
    } // for i
  } // if

  return label;
}


////////////////////////////////////////////////////////////////////////
// Class SchemaElement


function SchemaElement(element)
{
  this.el = element;
  this.name = GetAttStr(element, "name", "");
  this.type = GetAttStr(element, "type", "");
  this.minOccurs = GetAttStr(element, "minOccurs", 0);
  this.maxOccurs = GetAttStr(element, "maxOccurs", 0);
  this.documentation = GetElementStr(element, "./annotation/documentation", "");
}


////////////////////////////////////////////////////////////////////////
// Class Schema


function Schema(element)
{
  this.el = element;
  this.name = GetAttStr(element, "name", "");
  this.content = GetAttStr(element, "content", "");
  this.label = GetAttStr(element, "ctv:label", "");
  this.documentation = GetElementStr(element, "./annotation/documentation", "");
  var attributes = new Array();
  this.attributes = attributes;
  var elements = new Array();
  this.elements = elements;

  var kid = element.firstChild;
  while (kid != null) {
    if (kid.nodeType == 1) {
      var nodename = kid.nodeName;
      if (nodename == "attribute") {
        var att =
            new SchemaAttribute(
              kid);
        attributes[attributes.length] = att;
      } else if (nodename == "element") {
        var e =
            new SchemaElement(
              kid);
        elements[elements.length] = e;
      } // if
    } // if
    kid = kid.nextSibling;
  } // while

  return this;
}


Schema.prototype.InitFromSchema = function(obj, el)
{
  var atts = this.attributes;
  var n = atts.length;
  var i;
  for (i = 0; i < n; i++) {
    var att = atts[i];
    var name = att.name;
    var type = att.type;
    var init = att.init;
    var val = eval(init);

    if (type == "string") {
      val = GetAttStr(el, name, val);
    } else if (type == "int") {
      val = GetAttInt(el, name, val);
    } else if (type == "float") {
      val = GetAttFloat(el, name, val);
    } else if (type == "boolean") {
      val = GetAttBool(el, name, val);
    } else if (type == "view") {
      // We just ignore magic attributes.
    } else {
    } // if

    obj[name] = val;
  } // for i
}


Schema.prototype.AttsFromSchema = function(obj, indent)
{
  var str = "";
  var atts = this.attributes;
  var n = atts.length;
  var i;
  for (i = 0; i < n; i++) {
    var ignore = false;
    var att = atts[i];
    var name = att.name;
    var type = att.type;
    var init = att.init;
    var defaultstr = "" + eval(init);
    var val = obj[name];
    var valstr;

    if (type == "string") {
      valstr =
        QuoteAtt(
          val);
    } else if ((type == "int") ||
               (type == "float")) {
      valstr =
        "" + val
    } else if (type == "boolean") {
      valstr =
        val ? "1" : "0";
    } else if (type == "view") {
      ignore =
        true; // We just ignore magic attributes.
    } else {
      // Undefined type.
      ignore =
        true; // We just ignore magic attributes.
    } // if

    if (defaultstr == valstr) {
      ignore = true;
    } // if

    if (!ignore) {
      str +=
        indent + name + "=\"" + valstr + "\"\n";
    } // if
  } // for i

  return str;
}


Schema.LoadSchemasFromURL = function(url)
{
  Log.innerText = "Loading Schemas from '" + url + "'";

  var doc =
    LoadXMLDoc(
      url);

  if (doc == null) {
    Notice.innerHTML += "<HR/>Error loading schema from '" + url + "'!<HR/>";
    LoadError = 1;
    return false;
  } // if

  var el =
    doc.selectSingleNode("schema");

  if (el == null) {
    Notice.innerHTML += "<HR/>Error finding schema element in '" + url + "'!<HR/>";
    LoadError = 2;
    return false;
  } // if

  Schema.LoadSchemasFromElement(el);

  return true;
}


Schema.LoadSchemasFromElement = function(el)
{
  var schemas = new Array();
  var schemasdict = new Object();
  Schema.Schemas = schemas;
  Schema.SchemasDict = schemasdict;

  var kid = el.firstChild;
  while (kid != null) {
    if (kid.nodeType == 1) {
      var nodename = kid.nodeName;
      if (nodename == "complexType") {
        var schema =
            new Schema(kid);
        schemas[schemas.length] = schema;
        schemasdict[schema.name] = schema;
      } // if
    } // if
    kid = kid.nextSibling;
  } // while

  Schema.Commands =
    el.selectSingleNode("/schema/annotation/appinfo/commands");

  Schema.Templates =
    el.selectSingleNode("/schema/annotation/appinfo/templates");
  Schema.TemplatesDict =
    new Object();
}


Schema.FindSchema = function(name)
{
  if (Schema.SchemasDict == null) {
    return null;
  } // if

  return Schema.SchemasDict[name];
}


Schema.FindCommand = function(path)
{
  return Schema.Commands.selectSingleNode(path);
}


Schema.FindTemplate = function(name)
{
  if (Schema.Templates == null) {
    Notice.innerHTML += "<HR/>No templates loaded!<HR/>";
    LoadError = 3;
    return null;
  } // if

  var template =
    Schema.TemplatesDict[name];

  if (template == null) {
    var pattern =
      "/schema/annotation/appinfo/templates/*[@id='" + name + "']";
    var el =
      Schema.Templates.selectSingleNode(
        pattern);
    if (el == null) {
      Notice.innerHTML += "<HR/>Can't find template '" + name + "'!<HR/>";
      LoadError = 4;
    } else {
      template =
        new Template(
          name,
          el);
    } // if
    Schema.TemplatesDict[name] = template;
  } // if

  return template;
}


Schema.ExpandTemplate = function(name, dict)
{
  var template =
    Schema.FindTemplate(
      name);

  if (template == null) {
    return "[MISSING TEMPLATE: '" + name + "']";
  } else {
    return template.Expand(
      dict);
  } // if
}


Schema.MakeEditor = function(type, obj)
{
  var schema =
    Schema.FindSchema(type);

  if (schema == null) {
     return "[MISSING SCHEMA FOR TYPE '" + type + "'!]";
  } // if

  return Schema.MakeEditorFromSchema(schema, obj);
}


Schema.MakeEditorFromSchema = function(schema, obj)
{
  var body = "";
  var attributes = schema.attributes;
  var n = attributes.length;
  var i;

  for (i = 0; i < n; i++) {
    var att =
      attributes[i];
    body +=
      Schema.MakeAttEditorRow(schema, att, obj);
  } // for i

  return Schema.ExpandTemplate(
    "EditSchema", {
      "_BODY_": body,
      "_OBJID_": GetObjectID(obj),
      "_SCHEMAID_": GetObjectID(schema)
    });
}


Schema.MakeAttEditorRow = function(schema, att, obj)
{
  var atteditor =
    Schema.MakeAttEditor(
      schema,
      att,
      obj);

  var tooltip =
    schema.label + " " + att.label + ":\n  " +
    schema.name + "." + att.name +
    ": " + att.type + "\n  " +
    att.documentation;

  var atttemplate =
    Schema.FindTemplate("EditSchema_Attribute");

  return atttemplate.Expand({
    "_TOOLTIP_": QuoteAtt(tooltip),
    "_LABEL_": QuoteAtt(att.label),
    "_BODY_": atteditor,
    "_ATTID_": GetObjectID(att)
  });
}


Schema.MakeAttEditor = function(schema, att, obj)
{
  var attname = att.name;
  var atttype = att.type;
  var attedittypes = att.edittypes;
  var attedittype = att.edittypes[att.edittypeindex];
  var attlabel = att.label;
  var value = obj[attname];
  var enumerations = att.enumerations;
  var atteditor = "";

  if ((attedittype == "IntegerEnumeration") ||
      (attedittype == "StringEnumeration")) {
    var bodyattribute = "";

    var valuestr = "" + value;
    var m = enumerations.length;
    var j;
    var enumitemtemplate =
      Schema.FindTemplate(
        "EditSchema_Attribute_Enumeration_Item");

    for (j = 0; j < m; j++) {

      var enumer = enumerations[j];
      var val = enumer.value;
      var selected =
        (val == valuestr) ? "selected" : "deselected";
      var label =
        val + " : " + enumer.documentation;

      bodyattribute +=
        enumitemtemplate.Expand({
            "_VALUE_": QuoteAtt(val),
            "_LABEL_": QuoteAtt(label),
            "_SELECTED_": selected
          });

    } // for j

    var templatename = "EditSchema_Attribute_" + attedittype;

    atteditor =
      Schema.ExpandTemplate(
        templatename, {
          "_BODY_": bodyattribute
        });

  } else {

    var templatename =
      "EditSchema_Attribute_" + attedittype;
    var template =
      Schema.FindTemplate(
        templatename);

    if (template == null) {

      appeditor =
        "[UNKNOWN ATTRIBUTE TYPE: '" + attedittype + "']";

    } else {

      atteditor = 
        template.ExpandForAtt(
          att,
          obj);

/*
      dict = {
        "_NAME_": attname,
        "_VALUE_": value
      };

      var code =
        template.GetCode();
      if (code != null) {
        var newdict =
          code(schema, att, obj, value);
        if (newdict) {
          for (key in newdict) {
            var pattern;
            if (key[0] == "_") {
              pattern = key;
            } else {
              pattern = "_" + key + "_";
            } // if
            dict[pattern] = newdict[key];
          } // for key
        } // if
      } // if

      atteditor =
        template.expand(
          dict);
*/

    } // if

    appeditor =
      "[UNKNOWN ATTRIBUTE TYPE: '" + attedittype + "']";

  } // if

  return atteditor;
}


////////////////////////////////////////////////////////////////////////
// Class Template


function Template(name, el)
{
  this.name = name;
  this.el = el;
  this.text = null;
  this.GetCode();
  this.GetText();
}


Template.prototype.GetText = function()
{
  if (this.text == null) {
    if (this.el != null) {
      this.text =
        this.el.xml;
    } // if
  } // if

  return this.text;
}


Template.prototype.GetCode = function()
{
  if (this.code == null) {
    if (this.el != null) {
      var comment =
        this.el.firstChild;
      if ((comment != null) &&
          (comment.nodeType == 8)) {
        var text = comment.text;
        var func =
          "function TempFunc(schema, att, obj, value) {\n" +
          text +
          "\n}\nTempFunc\n";
        this.code =
          eval(func);
      } // if
    } // if
  } // if

  return this.code;
}


Template.prototype.Expand = function(dict)
{
  var text =
    this.GetText();

  if (dict != null) {
    for (key in dict) {
      var re =
        eval("/" + key + "/g");
      var val =
        dict[key];

      text =
        text.replace(
          re,
          val);

    } // for
  } // if

  return text;
}


Template.prototype.ExpandForAtt = function(att, obj)
{
  var schema = att.schema;
  var value = obj[att.name];

  var dict = {
    "_NAME_": att.name,
    "_VALUE_": QuoteAtt(value)
  };

  var code =
    this.GetCode();
  if (code != null) {
    var newdict =
      code(schema, att, obj, value);
    if (newdict) {
      for (key in newdict) {
        var pattern;
        if (key[0] == "_") {
          pattern = key;
        } else {
          pattern = "_" + key + "_";
        } // if
        dict[pattern] = newdict[key];
      } // for key
    } // if
  } // if

  return this.Expand(
    dict);
}


////////////////////////////////////////////////////////////////////////
// Class Skin


function Skin(el, url)
{
  this.el = el;
  this.url = url;

  this.Init(el);

  this.LoadResources();

  this.users = new Array();
  this.categories = new Array();
  this.devices = new Array();
  this.guis = new Array();

  if (el != null) {
    var kid = el.firstChild;

    while (kid != null) {
      if ((kid.nodeType == 1)) {
        var nodename = kid.nodeName;

        if (nodename == "user") {
          this.MakeUserFromElement(kid);
        } else if (nodename == "categories") {
          this.MakeCategoriesFromElement(kid);
        } else if (nodename == "device") {
          this.MakeDeviceFromElement(kid);
        } else if (nodename == "gui") {
          this.MakeGuiFromElement(kid);
        } else {
          // Unknown element.
        } // if
      } // if
      kid = kid.nextSibling;
    } // while
  } // if
}


Skin.FindSkin = function(name)
{
  var n = Skins.length;
  var i;
  for (i = 0; i < n; i++) {
    var skin = Skins[i];
    if (skin.name == name) {
      return skin;
    } // if
  } // for i

  return null;
}


Skin.LoadSkinsFromURL = function(url)
{
  Log.innerText = "Loading Skins from '" + url + "'\n";

  var doc =
    LoadXMLDoc(
      url);

  if (doc == null) {
    Notice.innerHTML += "<HR/>Error loading skins from '" + url + "'!<HR/>";
    LoadError = 7;
    return false;
  } // if

  var el =
    doc.selectSingleNode("skins");

  if (el == null) {
    Notice.innerHTML += "<HR/>Error finding skins element in '" + url + "'!<HR/>";
    LoadError = 8;
    return false;
  } // if

  EditorBaseRelative = 
    GetAttStr(
      el,
      "base",
      EditorBase);

  EditorBase =
    FileSystem.GetAbsolutePathName(
      EditorBaseRelative);
  EditorBase = 
    EditorBase.replace(/\\/g, "/");
  EditorBase = 
    "file://" + EditorBase;

  Skins = new Array();

  var kid = el.firstChild;
  while (kid != null) {
    if (kid.nodeType == 1) {
      var nodename = kid.nodeName;
      if (nodename == "skin") {
        var name = GetAttStr(kid, "name", "");
        var url = GetAttStr(kid, "url", "");

        Log.innerText = "Loading Skin '" + name + "' from '" + url + "'\n";

        var skin =
          Skin.LoadSkinFromURL(
            url);
        
        skin.url = url;

        Skins[Skins.length] = skin;
      } // if
    } // if
    kid = kid.nextSibling;
  } // while

  if (Skins.length > 0) {
    var skin = Skins[0];
    SetCurrentSkin(Skins[0], 0, -1);
  } // if

  return true;
}


Skin.LoadSkinFromURL = function(url)
{
  var fullurl =
    EditorBase + "/" + url;

  //Log.innerText = "Loading Skin from '" + fullurl + "'\n";

  var doc =
    LoadXMLDoc(
      fullurl);

  if (doc == null) {
    Notice.innerHTML += "<HR/>Error loading skin from '" + fullurl + "'!<HR/>";
    LoadError = 9;
    return null;
  } // if

  var el =
    doc.selectSingleNode("skin");

  if (el == null) {
    Notice.innerHTML += "<HR/>Error finding skin element in '" + fullurl + "'!<HR/>";
    LoadError = 10;
    return null;
  } // if

  var skin =
      new Skin(
        el,
        url);

  return skin;
}


Skin.prototype.Init = function(el)
{
  if (!Skin.schema) {
    Skin.schema = Schema.FindSchema("skin");
  } // if

  if (Skin.schema) {
    Skin.schema.InitFromSchema(this, el);
  } // if

  // Private

  this.resources = new Array();
  this.resourcesdict = new Object();
  this.damaged = 1;
  this.changed = 0;
}


Skin.prototype.InitNew = function(name, base, resourceurl)
{
  this.name = name;
  this.base = base;
  this.resourceurl = resourceurl;
}


Skin.prototype.Destroy = function(el)
{
  ClearObjectID(this);
}


Skin.prototype.Damage = function()
{
  this.damaged = 1;
  this.changed = 1;
  StartRepairTimer();
}


Skin.prototype.VisualDamage = function()
{
  this.damaged = 1;
  StartRepairTimer();
}


Skin.prototype.Change = function()
{
  this.changed = 1;
}


Skin.prototype.ClearChanged = function()
{
  this.changed = 0;
}


Skin.prototype.Repair = function()
{
  this.damaged = 0;

  var gui = 
    GetCurrentGui();
  if ((gui != null) &&
      (gui.skin == this)) {
    gui.Repair();
  } // if
}


Skin.prototype.LoadResources = function()
{
  var base = 
    this.base;
  var resourceurl = 
    this.resourceurl;

  if (base && resourceurl) {
    var url =
      EditorBase + "/" + base + "/" + resourceurl;

    this.LoadResourcesFromURL(url);
  } // if
}


Skin.prototype.LoadResourcesFromURL = function(url)
{
  var doc =
    LoadXMLDoc(
      url);

  if (doc == null) {
    Notice.innerHTML += "<HR/>Error loading resource from '" + url + "'!<HR/>";
    LoadError = 5;
    return;
  } // if

  var el =
    doc.selectSingleNode("resources");

  if (el == null) {
    Notice.innerHTML += "<HR/>Error finding resources element in '" + url + "'!<HR/>";
    LoadError = 6;
    return;
  } // if

  this.LoadResourcesFromElement(el);
}


Skin.prototype.NewResource = function(type, id, url)
{
  var resources = this.resources;
  var resourcesdict = this.resourcesdict;

  var res =
      new Resource(
        this);
    res.Init(
      type,
      id,
      url);

  var key = res.type + res.id;
  resourcesdict[key] = res;
  var len = resources.length;
  resources[len] = res;

  return res;
}


Skin.prototype.LoadResourcesFromElement = function(el)
{
  var kid = el.firstChild;
  var resources = this.resources;
  var resourcesdict = this.resourcesdict;

  while (kid != null) {
    if ((kid.nodeType == 1) &&
        (kid.nodeName == "resource")) {
      var res =
          new Resource(
            this);
      res.LoadFromElement(
        kid);
      var key = res.type + res.id;
      resourcesdict[key] = res;
      var len = resources.length;
      resources[len] = res;
    } // if
    kid = kid.nextSibling;
  } // while
}


Skin.prototype.GetResource = function(type, id)
{
  if (DisableResources) {
    return null;
  } // if

  var key = type + id;
  var resourcesdict = this.resourcesdict;
  if (resourcesdict.hasOwnProperty(key)) {
    var res = resourcesdict[key];
    return res;
  } else {
    return null;
  } // if
}


Skin.prototype.MakeUserFromElement = function(element)
{
  this.users[this.users.length] = element;
}


Skin.prototype.MakeCategoriesFromElement = function(element)
{
  this.categories[this.categories.length] = element;
}


Skin.prototype.MakeDeviceFromElement = function(element)
{
  this.devices[this.devices.length] = element;
}


Skin.prototype.MakeGuiFromElement = function(element)
{
  var gui = 
    new Object();
  var name = 
    GetAttStr(element, "name", "");
  var url = 
    GetAttStr(element, "url", "");
  this.MakeGuiNew(
    name,
    url);
}


Skin.prototype.MakeGuiNew = function(name, url)
{
  var gui = new Object();
  gui.name = name;
  gui.url = url;
  this.guis[this.guis.length] = gui;
}


Skin.prototype.FindGui = function(name)
{
  var guis = this.guis;
  var n = guis.length;
  var i;
  for (i = 0; i < n; i++) {
    var gui = guis[i];
    if (gui.name == name) {
      return gui;
    } // if
  } // for i

  return null;
}


Skin.prototype.GetName = function()
{
  return this.name;
}


Skin.prototype.Save = function()
{
  if (!EnableWriting) {
    return;
  } // if

  var str =
    "<skin\n" +
    "  name=\"" + this.name + "\"\n" +
    "  base=\"" + this.base + "\"\n" +
    "  resourceurl=\"" + this.resourceurl + "\"\n" +
    ">\n\n" +
    "  " + CopyrightComment + "\n\n";
  var n;
  var i;

  str +=
    "  <!-- Users -->\n\n";

  var users = this.users;
  n = users.length;
  for (i = 0; i < n; i++) {
    var user = users[i];
    str += "  " + user.xml + "\n\n";
  } // for i

  str +=
    "  <!-- Categories -->\n\n";

  var categories = this.categories;
  n = categories.length;
  for (i = 0; i < n; i++) {
    var category = categories[i];
    str += "  " + category.xml + "\n\n";
  } // for i

  str +=
    "  <!-- Devices -->\n\n";

  var devices = this.devices;
  n = devices.length;
  for (i = 0; i < n; i++) {
    var device = devices[i];
    str += "  " + device.xml + "\n\n";
  } // for i

  str +=
    "  <!-- Guis -->\n\n";

  var guis = this.guis;
  n = guis.length;
  for (i = 0; i < n; i++) {
    var gui = guis[i];
    str +=
      "  <gui\n" +
      "    name=\"" + gui.name + "\"\n" +
      "    url=\"" + gui.url + "\"\n" +
      "  />\n\n";
  } // for i

  str +=
    "</skin>\n";

  var filename = 
    StripFilePrefix(EditorBase) + "/" + this.url;

  var saved =
    SaveStringToFile(
      str,
      filename);

  if (saved) {
    var resources = this.resources;
    str = 
      "<resources>\n\n" +
      "  " + CopyrightComment + "\n\n";
    n = resources.length;
    for (i = 0; i < n; i++) {
      var res = resources[i];
      str += 
        res.SaveToXML();
    } // for i

    str += 
      "</resources>\n";

    var filename = 
      StripFilePrefix(EditorBase) + "/" + this.base + "/" + this.resourceurl;

    saved =
      SaveStringToFile(
        str,
        filename);
  } // if

  if (saved) {
    this.ClearChanged();
  } // if
}


////////////////////////////////////////////////////////////////////////
// Class Gui


function Gui(skin, url, el)
{
  this.skin = skin;
  this.url = url;
  this.el = el
  this.Init(el);

  var div =
    document.createElement(
      "DIV");

  div._target = this;
  div._type = "gui";

  this.div = div;
  this.buttons = new Array();

  GuiContainer.appendChild(div);

  this.div.onmousedown = this.HandleMouseDown;
  this.div.onmousemove = this.HandleMouseMove;
  this.div.onmouseup = this.HandleMouseUp;
  this.div.onlosecapture = this.HandleMouseUp;

  if (el != null) {
    var kid = el.firstChild;

    while (kid != null) {
      if ((kid.nodeType == 1) &&
	  (kid.nodeName == "button")) {
	button = new Button(this, kid);
      } // if
      kid = kid.nextSibling;
    } // while

  } // if

  return this
}


Gui.ClearCurrentGui = function()
{
  var gui = CurrentGui; // GetCurrentGui();
  if (gui != null) {
    gui.AskSave();
    gui.Destroy();
    CurrentGui = null; // SetCurrentGui(null);
  } // if
}


Gui.GotoGui = function(name)
{
  Gui.ClearCurrentGui();

  var skin = GetCurrentSkin();

  if (skin == null) {
    return false;
  } // if

  var gui = 
    skin.FindGui(
      name);
  if (gui == null) {
    var skinname =
      (skin == null) ? "undefined" : skin.name;
    Notice.innerHTML += "<HR/>Can't find Gui '" + name + "' in Skin '" + skinname + "'!<HR/>";
    LoadError = 11;
    return false;
  } // if

  //Log.innerText = "Loading Gui '" + name + "' from '" + gui.url + "'";
  Gui.LoadGuiFromURL(
    skin,
    gui.url);

  return true;
}


Gui.LoadGuiFromURL = function(skin, url)
{
  Log.innerText = 
    "Loading Gui from skin " + skin.name + " base " + EditorBase + "/" + skin.base + " url " + url + "\n";

  Gui.ClearCurrentGui();

  var fullurl =
    EditorBase + "/" + skin.base + "/" + url;

  var doc =
    LoadXMLDoc(
      fullurl);

  if (doc == null) {
    Notice.innerHTML += "<HR/>Error loading gui from '" + url + "'!<HR/>";
    LoadError = 12;
    return;
  } // if

  var el =
    doc.selectSingleNode("gui");

  if (el == null) {
    Notice.innerHTML += "<HR/>Error finding gui element in '" + url + "'!<HR/>";
    LoadError = 13;
    return;
  } // if

  var newgui = 
    new Gui(
      skin,
      url,
      el);

  SetCurrentGui(
    newgui)

  newgui.Repair();
}


Gui.prototype.Init = function(el)
{
  if (!Gui.schema) {
    Gui.schema = Schema.FindSchema("gui");
  } // if
  if (Gui.schema) {
    Gui.schema.InitFromSchema(this, el);
  } // if

  // Private

  this.x = 0;
  this.y = 0;
  this.tracking = 0;
  this.damaged = 1;
  this.changed = 0;
}


Gui.prototype.Destroy = function()
{
  var div = this.div
  var buttons = this.buttons;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var button = buttons[i];
    button.Destroy();
  } // for i

  if (div != null) {
    div.removeNode(true);
    div.innerText = "";
  } // if

  ClearObjectID(this);
}


Gui.prototype.Damage = function()
{
  this.damaged = 1;
  this.changed = 1;
  this.skin.Damage();
}


Gui.prototype.VisualDamage = function()
{
  this.damaged = 1;
  StartRepairTimer();
}


Gui.prototype.Change = function()
{
  this.changed = 1;
  this.skin.Change();
}


Gui.prototype.ClearChanged = function()
{
  this.changed = 0;

  var buttons = this.buttons;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var button = 
      buttons[i];
    button.ClearChanged();
  } // for i
}


Gui.prototype.AskSave = function()
{
  if (!EnableWriting) {
    return;
  } // if

  if (this.changed) {
    var msg =
      "Save changes to Gui '" + this.title + "' of Skin '" + this.skin.name + "'?";
    if (window.confirm(msg)) {
      this.Save();
    } // if
  } // if
}


Gui.prototype.Save = function()
{
  if (!EnableWriting) {
    return;
  } // if

  var skin = 
    this.skin;
  var url = 
    this.url;
  var filename =
    StripFilePrefix(EditorBase) + "/" + skin.base + "/" + url;

  Log.innerText = 
    "Saving Gui '" + this.title + "' to '" + filename + "'\n";

  var str =
    this.SaveToXML();

  var saved =
    SaveStringToFile(
      str,
      filename);

  if (saved) {
    this.ClearChanged();
  } // if
}


Gui.prototype.SaveToXML = function()
{
  if (!Gui.schema) {
    Gui.schema = Schema.FindSchema("gui");
  } // if
  if (!Gui.schema) {
    return "";
  } // if

  var atts =
    Gui.schema.AttsFromSchema(
      this,
      "  ");

  var str =
    "<gui\n" +
    atts +
    ">\n\n" +
    "  " + CopyrightComment + "\n\n";

  var buttons = 
    this.buttons;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var button = 
      buttons[i];
    str +=
      button.SaveToXML();
  } // for

  str +=
    "</gui>\n";

  return str;
}


Gui.prototype.Repair = function()
{
  if (this.damaged) {
    this.RefreshView();
    this.damaged = 0;
  } else {
    var buttons = this.buttons;
    var n = buttons.length;
    var i;
    for (i = 0; i < n; i++) {
      var button = buttons[i];
      button.Repair();
    } // for i
  } // if
}


Gui.prototype.RefreshView = function()
{
  var div = this.div;
  var style = div.style;

  this.viewx = this.x * ViewScale;
  this.viewy = this.y * ViewScale;
  this.viewwidth = this.width * ViewScale;
  this.viewheight = (this.height - this.bottomedge) * ViewScale;

  style.display = "block";
  style.position = "absolute";
  style.left = this.viewx;
  style.top = this.viewy;
  style.width = this.viewwidth;
  style.height = this.viewheight;
  style.backgroundColor = "white";
  style.cursor = "crosshair";

  var buttons = this.buttons;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var button = buttons[i];
    button.index = i;
    button.RefreshView();
  } // for i

  this.damaged = 0;
}


Gui.prototype.GetName = function()
{
  return this.title;
}


Gui.prototype.HandleMouseDown = function()
{
  var event = window.event;
  EventSource = event.srcElement;

  var el = event.srcElement;
  var gui = GetObjectFromElement(el, "gui");

  if (gui == null) {
    return false;
  } // if

  event.cancelBubble = true;

  SetCurrentGui(gui);

  var button = GetCurrentButton();
  if ((button != null) &&
      (button.gui != gui)) {
      SetCurrentButton(null);
  } // if

  var cell = GetCurrentCell();
  if ((cell != null) &&
      (cell.button != button)) {
      SetCurrentCell(null);
  } // if

  gui.tracking = 1;
  gui.div.setCapture();

  if (event.button == 2) {
    Editor_PieDivGuiEditor.HandleOnMouseDown();
  } // if

  return true;
}


Gui.prototype.HandleMouseMove = function()
{
  var gui = this; // GetCurrentGui();

  if ((gui == null) || (!gui.tracking)) {
    return false;
  } // if

  var event = window.event;
  EventSource = event.srcElement;

  event.cancelBubble = true;

  return true;
}


Gui.prototype.HandleMouseUp = function()
{
  return false;

  var gui = this; // GetCurrentGui();

  if ((gui == null) || (!gui.tracking)) {
    return false;
  } // if

  gui.tracking = 0;

  var event = window.event;
  EventSource = event.srcElement;

  event.cancelBubble = true;

  gui.div.releaseCapture()

  return true;
}


Gui.prototype.HandleMouseCancel = function()
{
  var gui = this; // GetCurrentGui();

  if ((gui == null) || (!gui.tracking)) {
    return false;
  } // if

  gui.tracking = 0;

  gui.div.releaseCapture()

  return true;
}


////////////////////////////////////////////////////////////////////////
// Class Button


function Button(gui, el)
{
  this.gui = gui;
  this.el = el;

  this.Init(el);

  var div =
    document.createElement(
      "DIV");

  div._target = this;
  div._type = "button";

  this.div = div;
  this.cells = new Array();

  gui.div.appendChild(div);

  gui.buttons[gui.buttons.length] = this;

  //this.div.onmousedown = this.HandleMouseDown;
  //this.div.onmousemove = this.HandleMouseMove;
  //this.div.onmouseup = this.HandleMouseUp;
  //this.div.onlosecapture = this.HandleMouseCancel;

  divstyle = div.style
  divstyle.backgroundColor = "transparent";

  var rows = this.rows;
  if (rows == 0) {
    rows = 1;
    this.rows = 1;
  } // if
  var columns = this.columns;
  if (columns == 0) {
    columns = 1;
    this.columns = 1;
  } // if
  var cells = rows * columns;

  var kid =
    (el == null) ? null : el.firstChild;

  var i;
  for (i = 0; (i < cells) || (kid != null); i++) {
    if ((kid == null) ||
        ((kid.nodeType == 1) &&
         (kid.nodeName == "cell"))) {
      cell = new Cell(this, kid);
    } // if
    if (kid != null) {
      kid = kid.nextSibling;
    } // if
  } // for

  return this;
}


Button.prototype.Destroy = function()
{
  var div = this.div
  var cells = this.cells;
  var n = cells.length;
  var i;
  for (i = 0; i < n; i++) {
    var cell = cells[i];
    cell.Destroy();
  } // for i

  if (div != null) {
    //div.removeNode(true)
    div.innerText = "";
  } // if

  ClearObjectID(this);
}


Button.prototype.Damage = function()
{
  this.damaged = 1;
  this.changed = 1;
  this.gui.Damage();
}


Button.prototype.VisualDamage = function()
{
  this.damaged = 1;
  StartRepairTimer();
}


Button.prototype.Change = function()
{
  this.changed = 1;
  this.gui.Change();
}


Button.prototype.ClearChanged = function()
{
  this.changed = 0;

  var cells = this.cells;
  var n = cells.length;
  var i;
  for (i = 0; i < n; i++) {
    var cell = 
      cells[i];
    cell.ClearChanged();
  } // for i
}


Button.prototype.SaveToXML = function()
{
  if (!Button.schema) {
    Button.schema = Schema.FindSchema("button");
  } // if
  if (!Button.schema) {
    return "";
  } // if

  var atts =
    Button.schema.AttsFromSchema(
      this,
      "    ");


  var contents = "";
  var cells = 
    this.cells;
  var n = cells.length;
  var i;
  for (i = 0; i < n; i++) {
    var cell = 
      cells[i];
    contents +=
      cell.SaveToXML();
  } // for

  var str;
  if (contents == "") {
    str = 
      "  <button\n" +
      atts +
      "  />\n\n";
  } else {
    str =
      "  <button\n" +
      atts +
      "  >\n\n" +
      contents +
      "  </button>\n\n";
  } // if

  return str;
}


Button.prototype.MoveBefore = function(sibling)
{
  var gui = this.gui;
  if ((sibling != null) &&
      (sibling.gui != gui)) {
    return;
  } // if

  var buttons = 
    gui.buttons;

  var thisindex = -1;
  var thatindex = -1;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var button = buttons[i];
    if (button == this) {
      thisindex = i;
    } // if
    if (button == sibling) {
      thatindex = i;
    } // if
  } // for i

  // Check if we're alread in the right place.
  if (((thatindex == -1) &&
       (thisindex == (n - 1))) ||
      (thisindex == thatindex - 1)) {
    return;
  } // if

  buttons.splice(thisindex, 1);

  if (thatindex == -1) {
    buttons.push(this);
    gui.div.insertBefore(this.div);
  } else {
    if (thatindex > thisindex) {
      thatindex--;
    } // if
    buttons.splice(thatindex, 0, this);
    gui.div.insertBefore(this.div, sibling.div);
  } // if

  n = buttons.length;
  for (i = 0; i < n; i++) {
    var button = buttons[i];
    button.index = i;
  } // for i

  button.Damage();
}


Button.prototype.ToFront = function(el)
{
  this.MoveBefore(
    null);
  this.gui.Damage();
}


Button.prototype.ToBack = function(el)
{
  var gui =
    this.gui;
  var buttons =
    gui.buttons;
  var n =
    buttons.length;
  if (n > 1) {
    this.MoveBefore(
      buttons[0]);
  } // if

  this.gui.Damage();
}


Button.prototype.Init = function(el)
{
  if (!Button.schema) {
    Button.schema = Schema.FindSchema("button");
  } // if
  if (Button.schema) {
    Button.schema.InitFromSchema(this, el);
  } // if

  // Private.

  this.tracking = 0;
  this.damaged = 1;
  this.hilited = 0;
  this.filter = "";
  this.backgroundcolor = "";
  this.state = 0;
}


Button.prototype.Repair = function()
{
  if (this.damaged) {
    this.RefreshView();
    this.damaged = 0;
  } else {
    var cells = this.cells;
    var n = cells.length;
    var i;
    for (i = 0; i < n; i++) {
      var cell = cells[i];
      cell.Repair();
    } // for i
  } // if
}


Button.prototype.RefreshView = function()
{
  var div = this.div;
  var style = div.style;
  var gui = this.gui;
  var filter = this.filter;
  var backgroundcolor = this.backgroundcolor;

  if (XRayMode) {
    backgroundcolor = "transparent"
  } // if

  this.viewx = this.x * ViewScale;
  this.viewy = this.y * ViewScale;
  this.viewwidth = this.width * ViewScale;
  this.viewheight = this.height * ViewScale;

  style.display = "block";
  style.position = "absolute";
  style.overflow = "hidden";
  style.left = this.viewx;
  style.top = this.viewy;
  style.width = this.viewwidth;
  style.height = this.viewheight;
  style.backgroundColor = backgroundcolor;
  style.filter = filter;

  var cells = this.cells;
  var n = cells.length;
  var i;
  for (i = 0; i < n; i++) {
    var cell = cells[i];
    cell.index = i;
    cell.RefreshView();
  } // for i

  this.damaged = 0;
}


Button.prototype.Move = function(x, y)
{
  var gui = this.gui;
  var w = gui.width;
  var h = gui.height - gui.bottomedge;
  var width = this.width;
  var height = this.height;
  if ((x + width) >= w) {
    x = w - width;
  } // if
  if (x < 0) {
    x = 0;
  } // if
  if ((y + height) >= h) {
    y = h - height;
  } // if
  if (y < 0) {
    y = 0;
  } // if
  this.x = x;
  this.y = y;
  var viewx = x * ViewScale;
  var viewy = y * ViewScale;
  this.viewx = viewx;
  this.viewy = viewy;
  var style = this.div.style;
  style.left = viewx;
  style.top = viewy;
  this.Change();
}


Button.prototype.Size = function(width, height)
{
  var gui = this.gui;
  var w = gui.width;
  var h = gui.height - gui.bottomedge;

  if (width > w) {
    width = w;
  } // if
  if (width < 1) {
    width = 1;
  } // if
  if (height > h) {
    height = h;
  } // if
  if (height < 1) {
    height = 1;
  } // if

  this.width = width;
  this.height = height;

  this.Move(this.x, this.y);

  this.Damage();
}


Button.prototype.GetName = function()
{
  var str =
    "Button #" + this.index;

  var cellcount = this.cells.length;
  str += " cells=" + cellcount;

  var id = this.id;
  if ((id != null) && (id != "")) {
    str += " id='" + id + "'";
  } // if

  var label = this.label;
  if ((label != null) && (label != "")) {
    str += " label='" + label + "'";
  } // if

  var source = this.source;
  if ((source != null) && (source != "")) {
    str += " source='" + source + "'";
  } // if

  return str;
}


Button.prototype.HandleMouseDown = function()
{
  var event = window.event;
  EventSource = event.srcElement;

  var el = event.srcElement;
  var button = GetObjectFromElement(el, "button");

  event.cancelBubble = true;

  SetCurrentButton(button);
  button.tracking = 1;
  button.div.setCapture();

  return true;
}


Button.prototype.HandleMouseMove = function()
{
  var button = GetCurrentButton();

  if ((button == null) || (!button.tracking)) {
    return false;
  } // if

  var event = window.event;
  EventSource = event.srcElement;

  event.cancelBubble = true;

  return true;
}


Button.prototype.HandleMouseUp = function()
{
  var button = GetCurrentButton();

  if ((button == null) || (!button.tracking)) {
    return false;
  } // if

  button.tracking = 0;

  var event = window.event;
  EventSource = event.srcElement;

  event.cancelBubble = true;

  button.div.releaseCapture()

  return true;
}


Button.prototype.HandleMouseCancel = function()
{
  var button = this; // GetCurrentButton();

  if ((button == null) || (!button.tracking)) {
    return false;
  } // if

  this.tracking = 0;

  this.div.releaseCapture()

  return true;
}


////////////////////////////////////////////////////////////////////////
// Class Cell


function Cell(button, el)
{
  this.button = button;
  this.el = el;

  this.Init(el);

  var gui = button.gui

  var div =
    document.createElement(
      "DIV");

  var backgrounddiv =
    document.createElement(
      "DIV");

  var labeldiv =
    document.createElement(
      "DIV");

  div._target = this;
  div._type = "cell";

  this.div = div;
  this.labeldiv = labeldiv;
  this.backgrounddiv = backgrounddiv;
  this.gui = gui;

  button.cells[button.cells.length] = this

  div.onmousedown = this.HandleMouseDown;
  div.onmousemove = this.HandleMouseMove;
  div.onmouseup = this.HandleMouseUp;
  div.onlosecapture = this.HandleLoseCapture;

  var divstyle = div.style;
  divstyle.backgroundColor = "transparent";

  var labelpadx = 2;
  var labelpady = 1;
  var labeldx = (this.labeldx + button.labeldx + labelpadx) * ViewScale;
  var labeldy = (this.labeldy + button.labeldy + labelpady) * ViewScale;

  var labeldivstyle = labeldiv.style;
  labeldivstyle.display = "block";
  labeldivstyle.position = "absolute";
  labeldivstyle.left = labeldx;
  labeldivstyle.top = labeldy;
  labeldivstyle.fontFamily = "arial"
  labeldivstyle.fontSize = 16;
  labeldivstyle.backgroundColor = "transparent";

  var backgrounddivstyle = backgrounddiv.style;
  backgrounddivstyle.display = "block";
  backgrounddivstyle.position = "absolute";
  backgrounddivstyle.top = 0;
  backgrounddivstyle.left = 0;
  backgrounddivstyle.backgroundColor = "transparent";

  button.div.appendChild(div);
  div.appendChild(backgrounddiv);
  div.appendChild(labeldiv);

  return this;
}


Cell.prototype.Destroy = function()
{
  var div = this.div;
  if (div != null) {
    //div.removeNode(true);
    div.innerText = "";
  } // if

  ClearObjectID(this);
}


Cell.prototype.Init = function(el)
{
  if (!Cell.schema) {
    Cell.schema = Schema.FindSchema("cell");
  } // if
  if (Cell.schema) {
    Cell.schema.InitFromSchema(this, el);
  } // if

  // Private run-time stuff.

  this.pieslice = pieSliceTap;
  this.x = 0;
  this.y = 0;
  this.width = 10;
  this.height = 10;
  this.row = 0;
  this.column = 0;
  this.index = 0;
  this.fontsize = 10;
  this.borderstyle = "solid";
  this.backgroundcolor = "white";
  this.textcolor = "black";
  this.bordercolor = "black";
  this.backgroundcolorselected = "black";
  this.textcolorselected = "white";
  this.bordercolorselected = "black";
  this.tracking = 0;
  this.pressed = 0;
  this.damaged = 1;
  this.state = 0;
  this.cursor = "hand";
}


Cell.prototype.Damage = function()
{
  this.damaged = 1;
  this.changed = 1;
  this.button.Damage();
}


Cell.prototype.VisualDamage = function()
{
  this.damaged = 1;
  StartRepairTimer();
}


Cell.prototype.Change = function()
{
  this.changed = 1;
  this.button.Change();
}


Cell.prototype.ClearChanged = function()
{
  this.changed = 0;
}


Cell.prototype.SaveToXML = function()
{
  if (!Cell.schema) {
    Cell.schema = Schema.FindSchema("cell");
  } // if
  if (!Cell.schema) {
    return "";
  } // if

  var atts =
    Cell.schema.AttsFromSchema(
      this,
      "      ");

  // Omit empty cells.
  if (atts == "") {
    return "";
  } // if

  var str =
    "    <cell\n" +
    atts +
    "    />\n\n";

  return str;
}


Cell.prototype.Repair = function()
{
  if (this.damaged) {
    this.RefreshView();
    this.damaged = 0;
  } // if
}


Cell.prototype.MoveBefore = function(sibling)
{
  var button = this.button;
  if ((sibling != null) &&
      (sibling.button != button)) {
    return;
  } // if

  var cells = 
    button.cells;

  var thisindex = -1;
  var thatindex = -1;
  var n = cells.length;
  var i;
  for (i = 0; i < n; i++) {
    var cell = cells[i];
    if (cell == this) {
      thisindex = i;
    } // if
    if (cell == sibling) {
      thatindex = i;
    } // if
  } // for i

  // Check if we're alread in the right place.
  if (((thatindex == -1) &&
       (thisindex == (n - 1))) ||
      (thisindex == thatindex - 1)) {
    return;
  } // if

  cells.splice(thisindex, 1);

  if (thatindex == -1) {
    cells.push(this);
    button.div.insertBefore(this.div);
  } else {
    if (thatindex > thisindex) {
      thatindex--;
    } // if
    cells.splice(thatindex, 0, this);
    button.div.insertBefore(this.div, sibling.div);
  } // if

  n = cells.length;
  for (i = 0; i < n; i++) {
    var cell = cells[i];
    cell.index = i;
  } // for i

  button.gui.Change();
}


Cell.prototype.ToFront = function(el)
{
  this.MoveBefore(
    null);
}


Cell.prototype.ToBack = function(el)
{
  var button =
    this.button;
  var cells =
    button.cells;
  var n =
    cells.length;
  if (n > 1) {
    this.MoveBefore(
      cells[0]);
  } // if
}


Cell.prototype.RefreshView = function()
{
  var div = this.div;
  var labeldiv = this.labeldiv;
  var backgrounddiv = this.backgrounddiv;
  var style = div.style;
  var index = this.index;
  var button = this.button;
  var gui = button.gui;
  var skin = gui.skin;
  var rows = button.rows;
  var columns = button.columns;
  var buttonwidth = button.width;
  var buttonheight = button.height;
  var cellwidth = Math.floor(buttonwidth / columns);
  var cellheight = Math.floor(buttonheight / rows);

  // Calculate row, column, position and size,
  // based on index and layout style.

  var column, row;
  if (button.rowlayout) {
    column = Math.floor(index % columns)
    row = Math.floor(index / columns)
  } else {
    column = Math.floor(index / rows)
    row = Math.floor(index % rows)
  } // if

  this.column = column;
  this.row = row;
  this.x = column * cellwidth;
  this.y = row * cellheight;

  var look = this.look;
  if (look == -1) {
    look = button.look;
  } // if

  var bw =
    BlackAndWhite && (look <= 0);

  // Compensate size of cell for special situations.

  if (column == (columns - 1)) {
    // Expand last column to include left-over space.
    cellwidth += (buttonwidth % columns);
  } else {
    if (bw) {
      // Expand all bw columns but last to include one extra pixel overlap.
      cellwidth += 1;
    } // if
  } // if

  if (row == (rows - 1)) {
    // Expand last row to include left-over space.
    cellheight += (buttonheight % rows);
  } else {
    if (bw) {
      // Expand all bw rows but last to include one extra pixel overlap.
      cellheight += 1;
    } // if
  } // if

  this.width = cellwidth
  this.height = cellheight
  this.viewx = this.x * ViewScale;
  this.viewy = this.y * ViewScale;
  this.viewwidth = this.width * ViewScale;
  this.viewheight = this.height * ViewScale;

  var backgroundcolor = this.backgroundcolor;
  var textcolor = this.bordercolor;
  var bordercolor = this.bordercolor;
  var backgroundhtml = "";
  var hires = button.hires;
  var stretch = button.stretch;
  var res = null;
  var backgroundimage = "";
  var backgroundimagewidth = 0;
  var backgroundimageheight = 0;
  var backgroundx = 0;
  var backgroundy = 0;

  // Try to get the bitmap resource from the look id.

  if (look > 0) {
    res = skin.GetResource("Tbmp", look);
    if (res != null) {
      backgroundimagewidth = res.width;
      backgroundimageheight = res.height;
      backgroundimage = res.fullurl;
    } // if
  } // if

  var state = this.state;

  // Buttons marked "overbackground" have an extra invisible state 0,
  // so their 0th bitmap state is shown in state 1, etc.

  var overbackground = button.overbackground;
  if (overbackground) {
    state -= 1;
  } // if

  var states = button.states;
  if (state >= states) {
    state = states - 1;
  } // if

  var invisible = 0;
  if (state < 0) {
    invisible = 1;
  }

  if (invisible) {
    backgroundcolor = "";
    backgroundimage = "";
  } else {
    if (backgroundimage == "") {

      // A normal button without a background image.

      // In non-zero states, just highlight with the selected colors.
      if (state) {
        backgroundcolor = this.backgroundcolorselected
        bordercolor = this.bordercolorselected
        textcolor = this.textcolorselected
      } // if

    } else {

      // A button with a background image.

      // We won't be needing the background color.
      backgroundcolor = "transparent";

      // Banded images are draw from consecutive bitmap resource ids.
      // The resizable button feature is not supported for banded images.
      var bands = button.bands;
      if (bands > 1) {

        // Handle multiple band images.

        // No background image, since all the bands are enclosed in a table.
	backgroundimage = "";

        // Make a dhtml table with the consecutive bands as background images.
	backgroundhtml =
	  MakeBandTiles(
            skin,
	    look,
	    bands,
            hires,
	    0, 0,
	    this.viewwidth,
	    this.viewheight);

      } else {

        // Handle single band resizable and fixed size images.

        // Make a div with the magic resizable background image.
        backgroundhtml =
          MakeStretchTiles(
            skin,
            backgroundimage,
            backgroundimagewidth, backgroundimageheight,
            hires, stretch, states, state,
            0, 0,
            this.viewwidth,
            this.viewheight);

        // No background image, since all the tiles are enclosed in a table.
        backgroundimage = "";

      } // if
    } // if
  } // if

  var backgroundurl = "";
  if (backgroundimage != "") {
    backgroundurl =
      "url(" + backgroundimage + ")"
  } // if

  var framed = this.framed;
  if (framed == -1) {
    framed = button.framed;
  } // if

  var borderstyle = this.borderstyle;

  // If look specified but missing, show a red dashed border.
  if ((look != 0) && (res == null)) {
    bordercolor = "red";
    borderstyle = "dashed";
    backgroundcolor = "gray";
    if (XRayMode) {
      backgroundcolor = "transparent";
    } // if
    framed = 1;
    look = 0;
  } // if

  var borderwidth = ViewScale;
  if ((framed == 0) || (look > 0)) {
    borderwidth = 0;
  } // if

  var active = this.active;
  if (!button.active) {
    active = 0;
  } // if

  var cursor =
    active ? "hand" : "move";

  self.cursor = cursor;

  var label =
    this.GetLabel();
  labeldiv.innerText = label;

  if (XRayMode &&
      (backgroundhtml == "")) {
    backgroundhtml = 
      MakeBackgroundHTML(
        skin,
        hires,
        0,
        0,
        this.viewwidth,
        this.viewheight);
    backgroundcolor = "transparent";
  } // if

  backgrounddiv.innerHTML = backgroundhtml;

  style.display = "block";
  style.position = "absolute";
  style.overflow = "hidden";
  style.left = this.viewx;
  style.top = this.viewy;
  style.width = this.viewwidth;
  style.height = this.viewheight;
  style.backgroundColor = backgroundcolor;
  style.color = textcolor;
  style.backgroundPositionX = backgroundx;
  style.backgroundPositionY = backgroundy;
  style.backgroundImage = backgroundurl;
  style.borderWidth = borderwidth;
  style.borderStyle = borderstyle;
  style.borderColor = bordercolor;
  style.fontSize = this.fontsize
  style.cursor = cursor;

  this.damaged = 0;
}


Cell.prototype.GetPieHandler = function()
{
  var str = "";
  var button = this.button;
  var pieslice = this.pieslice;

  if (pieslice == pieSliceTouch) {
    str = this.pietouch;
    if (str == "") {
      str = button.pietouch;
    } // if
  } else if (pieslice == pieSliceTap) {
    str = this.pietap;
    if (str == "") {
      str = button.pietap;
    } // if
  } else if (pieslice == pieSliceUp) {
    str = this.pieup;
    if (str == "") {
      str = button.pieup;
    } // if
  } else if (pieslice == pieSliceDown) {
    str = this.piedown;
    if (str == "") {
      str = button.piedown;
    } // if
  } else if (pieslice == pieSliceLeft) {
    str = this.pieleft;
    if (str == "") {
      str = button.pieleft;
    } // if
  } else if (pieslice == pieSliceRight) {
    str = this.pieright;
    if (str == "") {
      str = button.pieright;
    } // if
  } // if

  return str;
}


Cell.prototype.GetLabel = function()
{
  if (this.pressed) {
    var str = this.GetPieHandler();

    if (str != "") {
      if (str.charAt(0) != ':') {
	var i = str.indexOf(':');
	if (i == -1) {
	  return str;
	} else {
	  return str.substr(0, i);
	} // if
      } // if
    } // if
  } // if

  var button = this.button;
  var label;

  label = this.label;
  if (label != "") {
    return label;
  } // if

  label = button.label;
  if (label != "") {
    return label;
  } // if

  label = button.source;
  if (label != "") {
    return label;
  } // if

  return "";
}


Cell.prototype.GetName = function()
{
  var str =
    "Cell #" + this.index;

  str += " label='" + this.GetLabel() + "'";

  return str;
}


Cell.prototype.HandleMouseDown = function()
{
  var event = window.event;
  EventSource = event.srcElement;
  var el = event.srcElement;
  var cell = GetObjectFromElement(el, "cell");

  UpdateButtonTool();

  if (cell == null) {
    return false;
  } // if

  SetCurrentCell(cell);
  var button = cell.button;
  SetCurrentButton(button);
  var gui = button.gui;
  SetCurrentGui(gui);

  cell.altKey = event.altKey;
  cell.shiftKey = event.shiftKey;
  cell.ctrlKey = event.ctrlKey;
  cell.buttonNumber = event.button - 1;

  var topx = 0;
  var topy = 0;
  var x = Math.floor((event.x - topx) / ViewScale);
  var y = Math.floor((event.y - topy) / ViewScale);

  cell.downx = x;
  cell.downy = y;
  cell.curx = x;
  cell.cury = y;
  cell.dx = 0;
  cell.dy = 0;

  var track = true;
  cell.tracking = 1;

  if (cell.altKey) {
    track = cell.AltDown(x, y);
  } else if (cell.shiftKey) {
    track = cell.ShiftDown(x, y);
  } else if (cell.ctrlKey) {
    track = cell.CtrlDown(x, y);
  } else if (cell.buttonNumber) {
    track = cell.GuiPieDown(x, y);
  } else {
    track = cell.ButtonDown(x, y);
  } // if

  if (track) {
    cell.tracking = 1;
    cell.div.setCapture();
    event.cancelBubble = true;
  } else {
    cell.tracking = 0;
  } // if

  cell.button.gui.Repair();

  return track;
}


Cell.prototype.HandleMouseMove = function()
{
  var cell = GetCurrentCell();

  if ((cell == null) || (!cell.tracking)) {
    return false;
  } // if

  var event = window.event;
  EventSource = event.srcElement;

  event.cancelBubble = true;

  var topx = 0;
  var topy = 0;
  var x = Math.floor((event.x - topx) / ViewScale);
  var y = Math.floor((event.y - topy) / ViewScale);

  cell.curx = x;
  cell.cury = y;

  if (cell.tracking) {
    cell.dx = x - cell.downx;
    cell.dy = y - cell.downy;
  } else {
    cell.dx = 0;
    cell.dy = 0;
  } // if

  if (cell.altKey) {
    cell.AltMove(x, y);
  } else if (cell.shiftKey) {
    cell.ShiftMove(x, y);
  } else if (cell.ctrlKey) {
    cell.CtrlMove(x, y);
  } else if (cell.buttonNumber) {
    cell.GuiPieMove(x, y);
  } else {
    cell.ButtonMove(x, y);
  } // if

  cell.button.gui.Repair();

  return true;
}


Cell.prototype.HandleMouseUp = function()
{
  var cell = GetCurrentCell();

  var event = window.event;
  EventSource = event.srcElement;

  if ((cell == null) || (!cell.tracking)) {
    return false;
  } // if

  cell.tracking = 0;

  event.cancelBubble = true;

  cell.div.releaseCapture()

  var topx = 0;
  var topy = 0;
  var x = Math.floor((event.x - topx) / ViewScale);
  var y = Math.floor((event.y - topy) / ViewScale);

  if (cell.altKey) {
    cell.AltUp(x, y);
  } else if (cell.shiftKey) {
    cell.ShiftUp(x, y);
  } else if (cell.ctrlKey) {
    cell.CtrlUp(x, y);
  } else if (cell.buttonNumber) {
    cell.GuiPieUp(x, y);
  } else {
    cell.ButtonUp(x, y);
  } // if

  cell.button.gui.skin.Repair();

  return true;
}


Cell.prototype.HandleMouseCancel = function()
{
  var cell = this; // GetCurrentCell();

  if ((cell == null) || (!cell.tracking)) {
    return false;
  } // if

  cell.tracking = 0;

  cell.div.releaseCapture()

  if (cell.altKey) {
    cell.AltCancel();
  } else if (cell.shiftKey) {
    cell.ShiftCancel();
  } else if (cell.ctrlKey) {
    cell.CtrlCancel();
  } else if (cell.buttonNumber) {
    cell.GuiPieCancel();
  } else {
    cell.ButtonCancel();
  } // if

  EndOverlay();

  cell.button.gui.skin.Repair();

  return true;
}


Cell.prototype.HandleLoseCapture = function()
{
  var cell = GetCurrentCell();

  if (cell != null) {
    cell.HandleMouseCancel();
  } // if
}


Cell.prototype.ButtonDown = function(x, y)
{
  if (ButtonTool == "Drag") {
    return this.DragDown(x, y);
  } else if (ButtonTool == "Resize") {
    return this.ResizeDown(x, y);
  } else if (ButtonTool == "Pen") {
    return this.PenDown(x, y);
  } else {
    return false;
  } // if
}


Cell.prototype.ButtonMove = function(x, y)
{
  if (ButtonTool == "Drag") {
    return this.DragMove(x, y);
  } else if (ButtonTool == "Resize") {
    return this.ResizeMove(x, y);
  } else if (ButtonTool == "Pen") {
    return this.PenMove(x, y);
  } else {
    return false;
  } // if
}


Cell.prototype.ButtonUp = function(x, y)
{
  if (ButtonTool == "Drag") {
    return this.DragUp(x, y);
  } else if (ButtonTool == "Resize") {
    return this.ResizeUp(x, y);
  } else if (ButtonTool == "Pen") {
    return this.PenUp(x, y);
  } else {
    return false;
  } // if
}


Cell.prototype.ButtonCancel = function()
{
  if (ButtonTool == "Drag") {
    return this.DragCancel();
  } else if (ButtonTool == "Resize") {
    return this.ResizeCancel();
  } else if (ButtonTool == "Pen") {
    return this.PenCancel();
  } else {
    return false;
  } // if
}


Cell.prototype.AltDown = function(x, y)
{
  return this.ResizeDown(x, y);
}


Cell.prototype.AltMove = function(x, y)
{
  return this.ResizeMove(x, y);
}


Cell.prototype.AltUp = function(x, y)
{
  return this.ResizeUp(x, y);
}


Cell.prototype.AltCancel = function()
{
  return this.ResizeCancel();
}


Cell.prototype.ShiftDown = function(x, y)
{
  return this.DragDown(x, y);
}


Cell.prototype.ShiftMove = function(x, y)
{
  return this.DragMove(x, y);
}


Cell.prototype.ShiftUp = function(x, y)
{
  return this.DragUp(x, y);
}


Cell.prototype.ShiftCancel = function()
{
  return this.DragCancel();
}


Cell.prototype.CtrlDown = function(x, y)
{
  return this.GuiPieDown(x, y);
}


Cell.prototype.CtrlMove = function(x, y)
{
  return this.GuiPieMove(x, y);
}


Cell.prototype.CtrlUp = function(x, y)
{
  return this.GuiPieUp(x, y);
}


Cell.prototype.CtrlCancel = function()
{
  return this.GuiPieCancel();
}


Cell.prototype.DragDown = function(x, y)
{
  this.startx = this.button.x;
  this.starty = this.button.y;
  this.button.hilited = 1;
//  this.button.filter =
//    "progid:DXImageTransform.Microsoft.Shadow(direction=135, enabled=true), " +
//    "alpha(opacity=50)";
  this.button.backgroundcolor = "yellow";
  this.button.Damage();
  if (button.overbackground) {
    this.state = 1;
  } // if
  BeginOverlay(this.button.div, GuiContainer);
  this.DragMove(x, y);
  return true;
}


Cell.prototype.DragMove = function(x, y)
{
  if (!this.tracking) {
    return false;
  } // if

  this.button.Move(
    this.startx + this.dx,
    this.starty + this.dy);
  return true;
}


Cell.prototype.DragUp = function(x, y)
{
  this.DragMove(x, y);
  this.button.hilited = 0;
//  this.button.filter = "";
  this.button.backgroundcolor = "";
  this.button.Damage();
//  this.button.div.style.filter = "";
  this.state = 0;
  EndOverlay();
  return true;
}


Cell.prototype.DragCancel = function()
{
  this.button.hilited = 0;
//  this.button.filter = "";
  this.button.backgroundcolor = "";
  this.button.Damage();
//  this.button.div.style.filter = "";
  this.state = 0;
  EndOverlay();
  return true;
}


Cell.prototype.GuiPieDown = function(x, y)
{
  Editor_PieDivGuiEditor.HandleOnMouseDown();
  return false;
}


Cell.prototype.GuiPieMove = function(x, y)
{
  return false;
}


Cell.prototype.GuiPieUp = function(x, y)
{
  return false;
}


Cell.prototype.GuiPieCancel = function()
{
  return false;
}


Cell.prototype.ResizeDown = function(x, y)
{
  var button = this.button;
  this.startx0 = button.x;
  this.starty0 = button.y;
  this.startx1 = button.x + button.width;
  this.starty1 = button.y + button.height;
  this.button.hilited = 1;
//  this.button.filter =
//    "progid:DXImageTransform.Microsoft.Shadow(direction=135, enabled=true), " +
//    "alpha(opacity=50)";
  this.button.backgroundcolor = "yellow";
  button.Damage();
  if (button.overbackground) {
    this.state = 1;
  } // if

  var event = window.event;
  //event.srcElement = button.div;
  var offsetx = event.offsetX;
  var offsety = event.offsetY;

  var srcleft = 0;
  var srctop = 0;
  var el = event.srcElement;

  // Skip up to the button element.
  while (el != null) {
    if (el == button.div) {
      break;
    } // if
    el = el.parentElement;
  } // while

  // Sum the offsets of the button and its parents.
  while (el != null) {
    if (el.offsetParent == null) {
      break;
    } // if
    // Add any offsets that are defined.
    if (el.offsetLeft != null) {
      srcleft += el.offsetLeft;
      srctop += el.offsetTop;
    } // if
    // Jump up to the next offsetParent.
    el = el.offsetParent;
  } // while

  var offx = event.clientX - srcleft;
  var offy = event.clientY - srctop;
  var low = 1.0 / 3.0;
  var high = 2.0 / 3.0;
  var xx = offx / button.viewwidth;
  var yy = offy / button.viewheight;
  this.dragx0 = (xx < low);
  this.dragx1 = (xx > high);
  this.dragy0 = (yy < low);
  this.dragy1 = (yy > high);

  if (!(this.dragx0 | this.dragx1 | this.dragy0 | this.dragy1)) {
    this.dragx0 = true;
    this.dragy0 = true;
    this.dragx1 = true;
    this.dragy1 = true;
  } // if

  BeginOverlay(this.button.div, GuiContainer);
  this.ResizeMove(x, y);
  return true;
}


Cell.prototype.ResizeMove = function(x, y)
{
  if (!this.tracking) {
    return false;
  } // if

  var button = this.button;
  var gui = button.gui;
  var w = gui.width;
  var h = gui.height - gui.bottomedge;

  var x0 = this.startx0;
  var y0 = this.starty0;
  var x1 = this.startx1;
  var y1 = this.starty1;

  // Pass 1

  if (this.dragx0) {
    x0 += this.dx;
  } // if

  if (this.dragx1) {
    x1 += this.dx;
  } // if

  if (this.dragy0) {
    y0 += this.dy;
  } // if

  if (this.dragy1) {
    y1 += this.dy;
  } // if

  // Pass 2

  if (this.dragx0) {
    if (x0 >= x1) {
      x0 = x1 - 1;
    } // if
    if (x0 < 0) {
      x0 = 0;
    } // if
  } // if

  if (this.dragx1) {
    if (x1 <= x0) {
      x1 = x0 + 1;
    } // if
    if (x1 > w) {
      x1 = w;
    } // if
  } // if

  if (this.dragy0) {
    if (y0 >= y1) {
      y0 = y1 - 1;
    } // if
    if (y0 < 0) {
      y0 = 0;
    } // if
  } // if

  if (this.dragy1) {
    if (y1 <= y0) {
      y1 = y0 + 1;
    } // if
    if (y1 > h) {
      y1 = h;
    } // if
  } // if

  var w = x1 - x0;
  var h = y1 - y0;

  if ((button.width != w) || (button.height != h)) {
    button.Size(
      x1 - x0,
      y1 - y0);
  } // if
  if ((button.x != x0) || (button.y != y0)) {
    button.Move(
      x0, y0);
  } // if

  return true;
}


Cell.prototype.ResizeUp = function(x, y)
{
  this.ResizeMove(x, y);
  this.button.hilited = 0;
//  this.button.filter = "";
  this.button.backgroundcolor = "";
  this.button.Damage();
  this.state = 0;
  EndOverlay();
  return true;
}


Cell.prototype.ResizeCancel = function()
{
  this.button.hilited = 0;
//  this.button.filter = "";
  this.button.backgroundcolor = "";
  this.button.Damage();
  this.state = 0;
  EndOverlay();
  return true;
}


Cell.prototype.PenDown = function(x, y)
{
  if ((!this.active) || (!this.button.active)) {
    return false;
  } // if

  SetCurrentButton(this.button);
  SetCurrentCell(this);

  this.pieslice = pieSliceTouch;
  this.state = 1;
  this.pressed = 1;
  this.VisualDamage();

  this.PenMove(x, y);

  var action = this.action;
  if ((action == null) || (action == "")) {
    action = this.button.action;
  } // if
  if ((action != null) && (action != "")) {
    this.DoAction(action);
  } // if

  return true;
}


Cell.prototype.PenMove = function(x, y)
{
  if (!this.tracking) {
    return true;
  } // if

  this.dx = this.curx - this.downx;
  this.dy = this.cury - this.downy;
  this.TrackPie();

  return true;
}


Cell.prototype.PenUp = function(x, y)
{
  this.PenMove(x, y);
  var str = this.GetPieHandler();
  this.state = 0;
  this.pressed = 0;
  this.pieslice = pieSliceTouch;
  this.VisualDamage();

  this.DoPie(str);

  return true;
}


Cell.prototype.PenCancel = function(x, y)
{
  this.state = 0;
  this.pressed = 0;
  this.pieslice = pieSliceTouch;
  this.VisualDamage();

  return true;
}


Cell.prototype.TrackPie = function()
{
  var lastpieslice = this.pieslice;
  var button = this.button;
  var haveup =
    (this.pieup != "") || (button.pieup != "");
  var havedown =
    (this.piedown != "") || (button.piedown != "");
  var haveleft =
    (this.pieleft != "") || (button.pieleft != "");
  var haveright =
    (this.pieright != "") || (button.pieright != "");
  var vertical = haveup || havedown;
  var horizontal = haveleft || haveright;
  var quad = horizontal && vertical;
  var dx = this.dx;
  var dy = this.dy;
  var dist2 = (dx * dx) + (dy * dy);
  var minradius = PieStrokeDistance; // TODO: Get from User
  var pieslice = this.pieslice;

  if (dist2 < (minradius * minradius)) {
    pieslice = pieSliceTouch;
  } else {
    if (quad) {
      var absdx = (dx < 0) ? -dx : dx;
      var absdy = (dy < 0) ? -dy : dy;
      if (absdy > absdx) {
	if (dy < 0) {
	  pieslice = (haveup ? pieSliceUp : pieSliceTap);
	} else {
	  pieslice = (havedown ? pieSliceDown : pieSliceTap);
	} // if
      } else {
	if (dx < 0) {
	  pieslice = (haveleft ? pieSliceLeft : pieSliceTap);
	} else {
	  pieslice = (haveright ? pieSliceRight : pieSliceTap);
	} // if
      } // if
    } else if (vertical) {
      if (dy < 0) {
	pieslice = (haveup ? pieSliceUp : pieSliceTap);
      } else {
	pieslice = (havedown ? pieSliceDown : pieSliceTap);
      } // if
    } else if (horizontal) {
      if (dx < 0) {
	pieslice = (haveleft ? pieSliceLeft : pieSliceTap);
      } else {
	pieslice = (haveright ? pieSliceRight : pieSliceTap);
      } // if
    } else {
	pieslice = pieSliceTap;
    } // if
  } // if

  if (pieslice != lastpieslice) {
    this.VisualDamage();
  } // if

  this.pieslice = pieslice;
}


Cell.prototype.DoPie = function(str)
{
  var label = "";
  var action = "";

  if (str != "") {
      var i = str.indexOf(':');
      if (i == -1) {
        label = str;
      } else if (i == 0) {
        action = str.substr(1);
      } else {
        label = str.substr(0, i);
        action = str.substr(i + 1);
      } // if
  } // if

  if (action != "") {
    this.DoAction(action);
  } // if
}


Cell.prototype.DoAction = function(action)
{
  var cmd = "";
  var args = "";
  var i = action.indexOf(" ");
  if (i == -1) {
    cmd = action;
    args = "";
  } else {
    cmd = action.substr(0, i);
    args = action.substr(i + 1);
  } // if

  this.DoCommand(cmd, args);
}


Cell.prototype.DoCommand = function(cmd, args)
{
  Log.innerText = "DoCommand cmd: \"" + cmd + "\" args: \"" + args + "\" cell: " + this.GetName();

  if ((cmd == "gotogui") ||
      (cmd == "gotopage")) {
    this.HandleMouseCancel()
    Gui.GotoGui(args);
  } else if (cmd == "Browse") {
    this.HandleMouseCancel()
    Gui.GotoGui("Browser");
  } else {
    // Unknown command.
  }
}


////////////////////////////////////////////////////////////////////////
// Class Resource


function Resource(skin)
{
  this.skin = skin;

  return this;
}


Resource.prototype.LoadFromElement = function(el)
{
  this.el = el;
  this.cmd = GetAttStr(el, "cmd", "");
  this.type = GetAttStr(el, "type", "");
  this.id = GetAttStr(el, "id", "");
  this.SetURL(GetAttStr(el, "url", ""));
  if (this.type == "Tbmp") {
    this.compress = GetAttInt(el, "compress", 0);
    this.width = GetAttInt(el, "width", 0);
    this.height = GetAttInt(el, "height", 0);
  } else {
    
  } // if
}


Resource.prototype.Init = function(type, id, url)
{
  this.type = type;
  this.id = id;
  this.SetURL(url);
}


Resource.prototype.InitImage = function(cmd, compress, width, height)
{
  this.cmd = cmd;
  this.compress = compress;
  this.width = width;
  this.height = height;
}


Resource.prototype.InitXML = function()
{
}


Resource.prototype.Destroy = function()
{
  ClearObjectID(this);
}


Resource.prototype.SetURL = function(url)
{
  var skin = this.skin;
  var base = skin.base;
  this.url = url;
  this.fullurl = EditorBase + "/" + base + "/" + this.url;
}


Resource.prototype.Repair = function()
{
}


Resource.prototype.SaveToXML = function()
{
  var str =
    "  <resource\n" +
    "    cmd=\"" + this.cmd + "\"\n" +
    "    type=\"" + this.type + "\"\n" +
    "    id=\"" + this.id + "\"\n" +
    "    url=\"" + QuoteAtt(this.url) + "\"\n";

  if (this.type == "Tbmp") {
    str +=
      "    width=\"" + this.width + "\"\n" +
      "    height=\"" + this.height + "\"\n" +
      "    compress=\"" + this.compress + "\"\n";
  } else if (this.type = "xBIN") {
    // No extra attributes
  } else {
    // Unknown resource type
  } // if

  str += "  />\n\n";

  return str;
}


////////////////////////////////////////////////////////////////////////
// XML DOM Utilities


function GetAttStr(node, name, def)
{
  if (node == null) {
    return def;
  } // if

  var val =
    node.getAttribute(name);
  if (val == null) {
    val = def;
  } // if

  return val;
}


function GetAttFloat(node, name, def)
{
  if (node == null) {
    return def;
  } // if

  var val =
    GetAttStr(node, name, "");

  var ival =
    parseFloat(val);

  if (isNaN(ival)) {
    ival = def;
  } // if

  return ival;
}


function GetAttInt(node, name, def)
{
  if (node == null) {
    return def;
  } // if

  var val =
    GetAttStr(node, name, "");

  var ival =
    parseInt(val);

  if (isNaN(ival)) {
    ival = def;
  } // if

  return ival;
}


function ParseBool(val, def)
{
  if ((val === true) ||
      (val === false)) {
    return val;
  } // if

  var result = false;

  var ival =
    parseInt(val);

  if (isNaN(ival)) {
    val = "" + val;
    var lowerVal =
      val.toLowerCase();
    if ((lowerVal == "1") ||
        (lowerVal == "true") ||
        (lowerVal == "t") ||
        (lowerVal == "yes") ||
        (lowerVal == "y") ||
        (lowerVal == "on")) {
      result = true;
    } else if ((lowerVal == "0") ||
               (lowerVal == "false") ||
               (lowerVal == "f") ||
               (lowerVal == "no") ||
               (lowerVal == "n") ||
               (lowerVal == "off")) {
      result = false;
    } else {
      result = def ? true : false;
    } // if
  } else {
    if (ival) {
      result = true;
    } else {
      result = false;
    } // if
  } // if

  return result;
}


function GetAttBool(node, name, def)
{
  if (node == null) {
    return def;
  } // if

  var val =
    GetAttStr(node, name, null);

  if (val == null) {
    val = def;
  } else {
    val = ParseBool(val, def);
  } // if

  return val;
}


function GetElementStr(node, name, def)
{
  var val = "";
  var n =
    node.selectSingleNode(name);
  if (n != null) {
    var kid = n.firstChild;
    while (kid != null) {
      while (kid != null) {
	val += kid.xml;
	kid = kid.nextSibling;
      } // while
    } // while
  } // if

  return val;
}


function GetAttObj(node, name, def)
{
  var val = GetAttStr(node, name, null);

  if (val == null) {
    return def;
  } // if

  var obj = GetObjectFromID(val);

  if (obj == null) {
    return def;
  } // if

  return obj;
}


function DoParseError(doc, url)
{
  var err = doc.parseError;
  Notice.innerHTML +=
    "<HR/>PARSE ERROR:<BR/>" +
    "URL: " + url + "<BR/>" +
    "Line: " + err.line + "<BR/>" +
    "Pos: " + err.pos + "<BR/>" +
    "File Pos: " + err.filepos + "<BR/>" +
    "Source: " + err.srcText + "<BR/>" +
    "Reason: " + err.reason + "<HR/>";
  LoadError = 14;
}


function LoadXMLDoc(url)
{
  var doc =
    new ActiveXObject("Microsoft.XMLDOM");

  doc.async =
    false;
  doc.load(
    url);

  if (doc.parseError.errorCode) {
    DoParseError(doc, url);
    return null;
  } // if

  return doc
}


var QuoteDict = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '&': '&amp;'
};

function QuoteAtt(s)
{
  if (s == null) {
    return null;
  } // if
  s = "" + s;
  return s.replace(
    /[<>\"&]/g,
    function(s) {
      return QuoteDict[s];
    });
}


////////////////////////////////////////////////////////////////////////
// Editor Stuff


function SetButtonTool(tool)
{
  NextButtonTool = tool;
}


function UpdateButtonTool()
{
  // This is to defer tool switching till after tracking is finished.
  if (NextButtonTool != null) {
    ButtonTool = NextButtonTool;
    NextButtonTool = null;
  } // if
}


function CurrentButtonToFront()
{
  var button = 
    GetCurrentButton();

  if (button == null) {
    return;
  } // if

  button.ToFront();
}


function CurrentButtonToBack()
{
  var button = 
    GetCurrentButton();

  if (button == null) {
    return;
  } // if

  button.ToBack();
}


function GetCurrentSkin()
{
  if (CurrentSkin) {
    return CurrentSkin;
  } // if

  if (Skins.length > 0) {
    SetCurrentSkin(Skins[0], 0, -2);
  } // if

  return CurrentSkin;
}


function GetCurrentResource()
{
  var skin = CurrentSkin; // GetCurrentSkin();

  if (skin == null) {
    return null;
  } // if

  if (CurrentResource &&
      (CurrentResource.skin == skin)) {
    return CurrentResource;
  } // if

  if ((skin.resources != null) &&
      (skin.resources.length > 0)) {
    SetCurrentResource(skin.resources[0]);
  } // if

  return CurrentResource;
}


function GetCurrentGui()
{
  var skin = CurrentSkin; // GetCurrentSkin();

  if (skin == null) {
    return null;
  } // if

  if (CurrentGui &&
      (CurrentGui.skin == skin)) {
    return CurrentGui;
  } // if

  CurrentGui = null; // SetCurrentGui(null);

  var guis = skin.guis;
  if ((guis != null) &&
      (guis.length > 0)) {
    var gui = guis[0];
    var guiname = gui.name;
    Gui.GotoGui(
      guiname);
  } // if

  return CurrentGui;
}


function GetCurrentButton()
{
  var gui = GetCurrentGui();

  if (gui == null) {
    return null;
  } // if

  if (CurrentButton &&
      (CurrentButton.gui == gui)) {
    return CurrentButton;
  } // if

  SetCurrentButton(null);

  if (gui.buttons.length > 0) {
    SetCurrentButton(gui.buttons[0]);
  } // if

  return CurrentButton;
}


function GetCurrentCell()
{
  var button =
    GetCurrentButton();

  if (button == null) {
    return null;
  } // if

  if (CurrentCell &&
      (CurrentCell.button == button)) {
    return CurrentCell;
  } // if

  SetCurrentCell(null);

  if ((button.cells != null) &&
      (button.cells.length > 0)) {
    SetCurrentCell(button.cells[0]);
  } // if

  return CurrentCell;
}


function SetCurrentSkin(skin, silent, arg)
{
  if (skin == CurrentSkin) {
    return;
  } // if

  CurrentSkin = skin;

  var gui = CurrentGui; // GetCurrentGui();

  if ((gui == null) ||
      (gui.skin != skin)) {
    Gui.ClearCurrentGui(); // Gui.GotoGui("Home");
  } // if

  if (silent) {
    return;
  } // if

  if ((CurrentEditorType == "skin") ||
      (CurrentEditorType == "resource") ||
      (CurrentEditorType == "gui") ||
      (CurrentEditorType == "button") ||
      (CurrentEditorType == "cell")) {
    SelectEditor(CurrentEditor);
  } // if
}


function SetCurrentResource(res, silent)
{
  if (res == CurrentResource) {
    return;
  } // if

  if (res != null) {
    SetCurrentSkin(res.skin, silent, -13);
  } // if

  CurrentResource = res;

  if (silent) {
    return;
  } // if

  if (CurrentEditorType == "resource") {
    SelectEditor(CurrentEditor);
  } // if
}


function SetCurrentGui(gui, silent)
{
  if (gui == CurrentGui) {
    return;
  } // if

  if (gui != null) {
    SetCurrentSkin(gui.skin, silent, -13);
  } // if

  CurrentGui = gui;

  if (silent) {
    return;
  } // if

  if ((CurrentEditorType == "gui") ||
      (CurrentEditorType == "button") ||
      (CurrentEditorType == "cell")) {
    SelectEditor(CurrentEditor);
  } // if
}


function SetCurrentButton(button, silent)
{
  if (button == CurrentButton) {
    return;
  } // if

  if (button != null) {
    SetCurrentGui(button.gui, silent);
  } // if

  CurrentButton = button;

  if (silent) {
    return;
  } // if

  if ((CurrentEditorType == "button") ||
      (CurrentEditorType == "cell")) {
    SelectEditor(CurrentEditor);
  } // if
}


function SetCurrentCell(cell, silent)
{
  if (cell == CurrentCell) {
    return;
  } // if

  if (cell != null) {
    SetCurrentButton(cell.button, silent);
  } // if

  CurrentCell = cell;

  if (silent) {
    return;
  } // if

  if (CurrentEditorType == "cell") {
    SelectEditor(CurrentEditor);
  } // if
}


function SelectEditor(name)
{
  NextEditor = name;
  window.setTimeout("UpdateSelectedEditor()", SelectEditorDelay)

  return true;
}


function UpdateSelectedEditor()
{
  if (NextEditor == null) {
    return;
  } // if

  ReallySelectEditor(NextEditor);
  NextEditor = null;
}


function ReallySelectEditor(name)
{
  CurrentEditor = name;
  CurrentEditorType = "";
  EditorSelect.value = name;

  var fn = null;
  try {
    fn = eval("SelectEditor" + name);
  } catch(e) {
    fn = null;
  } // if

  var str = "";
  if (fn == null) {
    str = SelectEditorUnknown(name);
  } else {
    str = fn();
  } // if

  EditorContainer.innerHTML = str;
}


function SelectEditorNone()
{
  return Schema.ExpandTemplate("Editor_None", null);
}


function SelectEditorUnknown(name)
{
  return Schema.ExpandTemplate(
    "Editor_UnknownEditor", {
      "_NAME_": QuoteAtt(name)
    });
}


function SelectEditorIndex(name)
{
  var rows = "";
  var columns = "";
  var rowtemplate = 
    Schema.FindTemplate(
      "Editor_Index_Row");
  if (rowtemplate == null) {
    return "Can't find template 'Editor_Index_Row'! ";
  } // if
  var columntemplate = 
    Schema.FindTemplate(
      "Editor_Index_Column");
  if (columntemplate == null) {
    return "Can't find template 'Editor_Index_Column'! ";
  } // if
  var n = EditorNames.length;
  var i;
  for (i = 0; i < n; i++) {
    var a = EditorNames[i];
    var m = a.length;
    var label = a[0];
    var j;
    columns = "";
    for (j = 1; j < m; j++) {
      var b = a[j];
      columns += 
        columntemplate.Expand({
          "_EDITOR_": b[0],
          "_LONGNAME_": b[1],
          "_SHORTNAME_": b[2]
        });
    } // for j

    rows += 
      rowtemplate.Expand({
        "_LABEL_": label,
        "_COLUMNS_": columns
      });
  } // for i

  return Schema.ExpandTemplate(
    "Editor_Index", {
      "_ROWS_": rows
    });
}


function SelectEditorHelp(name)
{
  return Schema.ExpandTemplate(
    "Editor_Help", {
    });
}


function SelectEditorCommands()
{
  return Schema.ExpandTemplate(
    "Editor_Commands", {
    });
}


function SelectEditorGuiViewXML()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "gui";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  var fullurl =
    EditorBase + "/" + gui.skin.base + "/" + gui.url;

  EditorContainer._target = gui;
  EditorContainer._type = "gui";

  return Schema.ExpandTemplate(
    "Editor_GuiViewXML", {
      "_URL_": QuoteAtt(fullurl)
    });
}


function SelectEditorGuiViewText()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "gui";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  var fullurl =
    EditorBase + "/" + gui.skin.base + "/" + gui.url;
  var path =
    StripFilePrefix(
      fullurl);

  var text = "";
  try {
    var f =
      FileSystem.OpenTextFile(
        path,
        1, true);
    text =
      f.ReadAll();
    f.Close();
  } catch(e) {
    text = "Error reading file '" + fullurl + "'.";
  } // try

  // Convert text to html.
  TempDiv.innerText = text;
  var html = TempDiv.innerHTML;
  TempDiv.innerText = "";

  EditorContainer._target = gui;
  EditorContainer._type = "gui";

  return Schema.ExpandTemplate(
    "Editor_GuiViewText", {
      "_URL_": QuoteAtt(fullurl),
      "_HTML_": html
    });
}

function SelectEditorSkinIndex()
{
  var body =
    MakeSkinIndex();

  CurrentEditorType = "skins";

  return Schema.ExpandTemplate(
    "Editor_SkinIndex", {
      "_N_": Skins.length,
      "_BODY_": body
    });
}


function MakeSkinIndex()
{
  var n = Skins.length;
  if (n == 0) {
    return "<LI>(No Skins.)</LI>";
  } // if
  var itemtemplate =
    Schema.FindTemplate(
      "Editor_SkinIndex_Item");
  var body = "";
  var i;
  for (i = 0; i < n; i++) {
    var skin = Skins[i];
    body +=
      itemtemplate.Expand({
          "_I_": i,
          "_NAME_": QuoteAtt(skin.name)
        });
  } // for i

  return body;
}


function SelectEditorSkinEditor()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "skin";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  var body = Schema.MakeEditor("skin", skin);

  EditorContainer._target = skin;
  EditorContainer._type = "skin";

  return Schema.ExpandTemplate(
    "Editor_SkinEditor", {
      "_NGUIS_": skin.guis.length,
      "_NRESOURCES_": skin.resources.length,
      "_BODY_": body
    });
}


function SelectEditorSkinCreator()
{
  var base = 
    EditorBase;

  CurrentEditorType = "skin";

  return Schema.ExpandTemplate(
    "Editor_SkinCreator", {
      "_BASE_": QuoteAtt(base)
    });
}


function GetNextGuiResourceID()
{
  var resid = 
    GuiResourceIDBase;
  var skin = 
    GetCurrentSkin();
  if (skin == null) {
    return resid;
  } // if

  var restype = 
    "xBIN";

  while (1) {
    var res =
      skin.GetResource(
        restype,
        resid);
    if (res == null) {
      return resid;
    } // if
    resid++;
  } // for id
}


function GetNextImageResourceID()
{
  var resid = 
    ImageResourceIDBase;
  var skin = 
    GetCurrentSkin();
  if (skin == null) {
    return resid;
  } // if

  var restype = 
    "Tbmp";

  while (1) {
    var res =
      skin.GetResource(
        restype,
        resid);
    if (res == null) {
      return resid;
    } // if
    resid++;
  } // for id
}


function GetNextXMLResourceID()
{
  var resid = 
    XMLResourceIDBase;
  var skin = 
    GetCurrentSkin();
  if (skin == null) {
    return resid;
  } // if

  var restype = 
    "xBMP";

  while (1) {
    var res =
      skin.GetResource(
        restype,
        resid);
    if (res == null) {
      return resid;
    } // if
    resid++;
  } // for id
}


function SelectEditorSkinDeleter()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "skin";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_SkinDeleter", {
      "_NAME_": QuoteAtt(skin.name),
      "_BASE_": QuoteAtt(EditorBase + "/" + skin.base)
    });
}


function SelectEditorGuiIndex()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "skin";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  EditorContainer._target = skin;
  EditorContainer._type = "skin";

  var body = MakeGuiIndex();

  return Schema.ExpandTemplate(
    "Editor_GuiIndex", {
      "_N_": skin.guis.length,
      "_BODY_": body
    });
}


function MakeGuiIndex()
{
  var skin = GetCurrentSkin();
  if (skin == null) {
    return "<LI>(No Current Skin.)</LI>";
  } // if
  var guis = skin.guis;
  var n = guis.length;
  if (n == 0) {
    return "<LI>(No Guis.)</LI>";
  } // if
  var body = "";
  var itemtemplate =
    Schema.FindTemplate(
      "Editor_GuiIndex_Item");
  var i;
  for (i = 0; i < n; i++) {
    var gui = guis[i];
    body +=
      itemtemplate.Expand({
          "_I_": i,
          "_NAME_": QuoteAtt(gui.name)
        });
  } // for i
  return body;
}


function SelectEditorGuiEditor()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "gui";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  EditorContainer._target = gui;
  EditorContainer._type = "gui";

  var body = Schema.MakeEditor("gui", gui);

  return Schema.ExpandTemplate(
    "Editor_GuiEditor", {
      "_N_": gui.buttons.length,
      "_BODY_": body
    });
}


function SelectEditorGuiCreator()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "gui";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_GuiCreator", {
      "_RESID_": QuoteAtt(GetNextGuiResourceID())
    });
}


function SelectEditorGuiDeleter()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "gui";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_GuiDeleter", {
      "_TITLE_": QuoteAtt(gui.title)
    });
}


function SelectEditorButtonIndex()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "gui";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  EditorContainer._target = gui;
  EditorContainer._type = "gui";

  var body = MakeButtonIndex();

  return Schema.ExpandTemplate(
    "Editor_ButtonIndex", {
      "_N_": gui.buttons.length,
      "_BODY_": body
    });
}


function MakeButtonIndex()
{
  var gui = GetCurrentGui()
  if (gui == null) {
    return "<LI>(No Current Gui.)</LI>";
  } // if
  var buttons = gui.buttons;
  var n = buttons.length;
  if (n == 0) {
    return "<LI>(No Buttons.)</LI>";
  } // if
  var body = "";
  var itemtemplate =
    Schema.FindTemplate(
      "Editor_ButtonIndex_Item");
  var i;
  for (i = 0; i < n; i++) {
    var button = buttons[i];
    body +=
      itemtemplate.Expand({
          "_I_": i,
          "_NAME_": QuoteAtt(button.GetName())
        });
  } // for i
  return body;
}


function SelectEditorButtonEditor()
{
  var button = GetCurrentButton();

  CurrentEditorType = "button";

  if (button == null) {
    return Schema.ExpandTemplate("Error_NoCurrentButton", null);
  } // if

  EditorContainer._target = button;
  EditorContainer._type = "button";

  var body = Schema.MakeEditor("button", button);

  return Schema.ExpandTemplate(
    "Editor_ButtonEditor", {
      "_N_": button.cells.length,
      "_BODY_": body
    });
}


function SelectEditorButtonCreator()
{
  var gui = GetCurrentGui();

  CurrentEditorType = "button";

  if (gui == null) {
    return Schema.ExpandTemplate("Error_NoCurrentGui", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_ButtonCreator", {
      "_MENU_": MakeNewButtonPositionMenu(gui)
    });
}


function MakeNewButtonPositionMenu(gui)
{
  var buttons =
    gui.buttons;
  items = new Array();
  var n =
    buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    items[i] =
      [i, "Before Button #" + i];
  } // for
  items[n] = 
    [n, "Last"];
  return MakeSelectMenu(
    "_pos",
    null,
    null,
    items,
    n);
}


function SelectEditorButtonDeleter()
{
  var button = GetCurrentButton();

  CurrentEditorType = "button";

  if (button == null) {
    return Schema.ExpandTemplate("Error_NoCurrentButton", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_ButtonDeleter", {
      "_NAME_": QuoteAtt(button.GetName())
    });
}


function SelectEditorCellIndex()
{
  var button = GetCurrentButton();

  CurrentEditorType = "button";

  if (button == null) {
    return Schema.ExpandTemplate("Error_NoCurrentButton", null);
  } // if

  EditorContainer._target = button;
  EditorContainer._type = "button";

  var body = MakeCellIndex();

  return Schema.ExpandTemplate(
    "Editor_CellIndex", {
      "_N_": button.cells.length,
      "_BODY_": body
    });
}


function MakeCellIndex(button)
{
  var button = GetCurrentButton();
  if (button == null) {
    return "<LI>(No Current Button.)</LI>";
  } // if
  var cells = button.cells;
  var n = cells.length;
  if (n == 0) {
    return "<LI>(No Cells.)</LI>";
  } // if
  var body = "";
  var itemtemplate =
    Schema.FindTemplate(
      "Editor_CellIndex_Item");
  var i;
  for (i = 0; i < n; i++) {
    var cell = cells[i];
    body +=
      itemtemplate.Expand({
          "_I_": i,
          "_NAME_": QuoteAtt(cell.GetName())
        });
  } // for i
  return body;
}


function SelectEditorCellEditor()
{
  var cell = GetCurrentCell();

  CurrentEditorType = "cell";

  if (cell == null) {
    return Schema.ExpandTemplate("Error_NoCurrentCell", null);
  } // if

  EditorContainer._target = cell;
  EditorContainer._type = "cell";

  var body = Schema.MakeEditor("cell", cell);

  return Schema.ExpandTemplate(
    "Editor_CellEditor", {
      "_BODY_": body
    });
}


function SelectEditorCellCreator()
{
  var button = GetCurrentButton();

  CurrentEditorType = "cell";

  if (button == null) {
    return Schema.ExpandTemplate("Error_NoCurrentButton", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_CellCreator", {
      "_MENU_": MakeNewCellPositionMenu(button)
    });
}


function MakeNewCellPositionMenu(button)
{
  var cells =
    button.cells;
  items = new Array();
  var n =
    cells.length;
  var i;
  for (i = 0; i < n; i++) {
    items[i] =
      [i, "Before Cell #" + i];
  } // for
  items[n] = 
    [n, "Last"];
  return MakeSelectMenu(
    "_pos",
    null,
    null,
    items,
    n);
}


function SelectEditorCellDeleter()
{
  var cell = GetCurrentCell();

  CurrentEditorType = "cell";

  if (cell == null) {
    return Schema.ExpandTemplate("Error_NoCurrentCell", null);
  } // if

  var button = cell.button;
  var cells = button.cells;
  var n = cells.length;

  if (n <= 1) {
    return Schema.ExpandTemplate(
      "Editor_CellDeleter_NotLast", {
      });
  } // if

  return Schema.ExpandTemplate(
    "Editor_CellDeleter", {
      "_NAME_": QuoteAtt(cell.GetName())
    });
}


function SelectEditorResourceIndex()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "skin";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  var body = MakeResourceIndex();
  var resources = skin.resources;

  return Schema.ExpandTemplate(
    "Editor_ResourceIndex", {
      "_N_": resources.length,
      "_BODY_": body
    });
}


function MakeResourceIndex()
{
  var skin = GetCurrentSkin();
  if (skin == null) {
    return "<LI>(No Current Skin.)</LI>";
  } // if
  var resources = skin.resources;
  var n = resources.length;
  if (n == 0) {
    return "<LI>(No Resources.)</LI>";
  } // if
  var body = "";
  var itemtemplate =
    Schema.FindTemplate(
      "Editor_ResourceIndex_Item");
  var i;
  for (i = 0; i < n; i++) {
    var res = resources[i];
    body +=
      itemtemplate.Expand({
          "_I_": i,
          "_TYPE_": res.type,
          "_ID_": res.id,
          "_BASE_": skin.base,
          "_URL_": res.url,
          "_FULLURL_": res.fullurl
        });
  } // for i
  return body;
}


function SelectEditorResourceEditor()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "resource";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  var res = GetCurrentResource();

  if (res == null) {
    return Schema.ExpandTemplate("Error_NoCurrentResource", null);
  } // if

  var body = '';
  var restype = res.type;
  if (restype == "Tbmp") {
    body =
      Schema.ExpandTemplate(
        "Editor_ResourceEditor_Bitmap", {
          "_WIDTH_": res.width,
          "_HEIGHT_": res.height,
          "_COMPRESS_": res.compress,
          "_URL_": QuoteAtt(res.fullurl)
        });
  } else if (restype == "xBIN") {
    body =
      Schema.ExpandTemplate(
        "Editor_ResourceEditor_XML", {
          "_URL_": QuoteAtt(res.fullurl)
        });
  } else {
    body = '';
  } // if

  EditorContainer._target = res;
  EditorContainer._type = "resource";

  return Schema.ExpandTemplate(
    "Editor_ResourceEditor", {
      "_TYPE_": QuoteAtt(res.type),
      "_ID_": QuoteAtt(res.id),
      "_URL_": QuoteAtt(res.fullurl),
      "_BODY_": body
    });
}


function SelectEditorResourceCreator()
{
  var skin = GetCurrentSkin();

  CurrentEditorType = "resource";

  if (skin == null) {
    return Schema.ExpandTemplate("Error_NoCurrentSkin", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_ResourceCreator", {
      "_RESID_": QuoteAtt(GetNextImageResourceID())
    });
}


function SelectEditorResourceDeleter()
{
  var res = GetCurrentResource();

  CurrentEditorType = "resource";

  if (res == null) {
    return Schema.ExpandTemplate("Error_NoCurrentResource", null);
  } // if

  return Schema.ExpandTemplate(
    "Editor_ResourceDeleter", {
      "_TYPE_": QuoteAtt(res.type),
      "_ID_": QuoteAtt(res.id),
      "_URL_": QuoteAtt(res.url)
    });
}


function SelectEditorSchemaIndex()
{
  var schemaindextemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex");
  var complextypetemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex_ComplexType");
  var elementtemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex_Element");
  var atttemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex_Attribute");
  var enumtemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex_Enumeration");
  var enumitemtemplate =
    Schema.FindTemplate(
      "Editor_SchemaIndex_Enumeration_Item");
  var body = "";
  var i, j, k;
  var schemas = Schema.Schemas;
  if (schemas == null) {
    return "No Schemas loaded! ";
  } // if
  var n = schemas.length;

  for (i = 0; i < n; i++) {

    var schema = schemas[i];
    var attributes = schema.attributes;
    var elements = schema.elements;
    var bodyattributes = "";
    var nattributes = attributes.length;

    for (j = 0; j < nattributes; j++) {

      var att = attributes[j];
      var bodyenumeration = "";
      var enumerations = att.enumerations;

      if (enumerations.length > 0) {

        var bodyenumerationitems = "";
        var nenumerations = enumerations.length;

        for (k = 0; k < nenumerations; k++) {

          var enumer = enumerations[k];

          bodyenumerationitems +=
            enumitemtemplate.Expand({
                "_VAL_": QuoteAtt(enumer.value),
                "_DOC_": QuoteAtt(enumer.documentation)
              });

        } // for k

        bodyenumeration =
          enumtemplate.Expand({
              "_BODY_": bodyenumerationitems
            });

      } // if

      bodyattributes +=
        atttemplate.Expand({
            "_SCHEMANAME_": QuoteAtt(schema.name),
            "_NAME_": QuoteAtt(att.name),
            "_LABEL_": QuoteAtt(att.label),
            "_TYPE_": QuoteAtt(att.type),
            "_DOC_": QuoteAtt(att.documentation),
            "_BODY_": bodyenumeration
          });

    } // for j

    var bodyelements = "";
    var nelements = elements.length;

    for (j = 0; j < nelements; j++) {

      var el = elements[j];

      bodyelements +=
        elementtemplate.Expand({
            "_NAME_": QuoteAtt(el.name),
            "_MINOCCURS_": el.minOccurs,
            "_MAXOCCURS_": el.maxOccurs,
            "_DOC_": QuoteAtt(el.documentation)
          });

    } // for j

    body +=
      complextypetemplate.Expand({
          "_LABEL_": QuoteAtt(schema.label),
          "_NAME_": QuoteAtt(schema.name),
          "_CONTENT_": QuoteAtt(schema.content),
          "_DOC_": QuoteAtt(schema.documentation),
          "_NATTRIBUTES_": nattributes,
          "_NELEMENTS_": nelements,
          "_BODYATTRIBUTES_": bodyattributes,
          "_BODYELEMENTS_": bodyelements
        });

  } // for i

  return schemaindextemplate.Expand({
      "_URL_": QuoteAtt(SchemaURL),
      "_BODY_": body
    });
}


function SelectSkin(index, edit)
{
  var skin = Skins[index];

  if (skin == null) {
    return;
  } // if

  SetCurrentSkin(skin, 0, -3);

  if (edit == -1) {
    // Do nothing.
  } else if (edit == 0) {
    SelectEditor("GuiIndex");
  } else if (edit == 1) {
    SelectEditor("SkinEditor");
  } // if
}


function SelectGui(index, edit)
{
  var skin = GetCurrentSkin();
  if (skin == null) {
    return;
  } // if

  var gui = skin.guis[index];
  if (gui == null) {
    return;
  } // if

  var url = gui.url;
  Gui.LoadGuiFromURL(
    skin,
    url);

  if (edit == -1) {
    // Do nothing.
  } else if (edit == 0) {
    SelectEditor("ButtonIndex");
  } else if (edit == 1) {
    SelectEditor("GuiEditor");
  } // if
}


function SelectButton(index, edit)
{
  var gui = GetCurrentGui();

  if (gui == null) {
    return;
  } // if

  var button = gui.buttons[index];
  if (button == null) {
    return;
  } // if

  SetCurrentButton(button);

  if (edit == -1) {
    // Do nothing.
  } else if (edit == 0) {
    SelectEditor("CellIndex");
  } else if (edit == 1) {
    SelectEditor("ButtonEditor");
  } // if
}


function SelectCell(index, edit)
{
  var button = GetCurrentButton();
  if (button == null) {
    return;
  } // if

  var cell = button.cells[index];
  if (cell == null) {
    return;
  } // if

  SetCurrentCell(cell);

  if (edit == -1) {
    // Do nothing.
  } else if (edit == 0) {
    // Do nothing.
  } else if (edit == 1) {
    SelectEditor("CellEditor");
  } // if
}


function SelectResource(index, edit)
{
  var skin = GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  var res = skin.resources[index];
  if (res == null) {
    return;
  } // if

  SetCurrentResource(res);

  if (edit == -1) {
    // Do nothing.
  } else if (edit == 0) {
    // Do nothing.
  } else if (edit == 1) {
    SelectEditor("ResourceEditor");
  } // if
}


function EditNextResource(dir)
{
  var skin = GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  var resources = skin.resources;
  var n = resources.length;

  if (n == 0) {
    SetCurrentResource(null);
    return;
  } // if

  var found = 0;
  if (CurrentResource != null) {

    var i;
    for (i = 0; i < n; i++) {
      if (resources[i] == CurrentResource) {
        if (dir < 0) {
          if (i == 0) {
            i = n - 1;
          } else {
            i--;
          } // if
        } else {
          if (i == n - 1) {
            i = 0;
          } else {
            i++;
          } // if
        } // if
        SetCurrentResource(resources[i]);
        found = 1;
        break;
      } // if
    } // for i

  } // if

  if (!found) {
    if (dir < 0) {
      SetCurrentResource(resources[n - 1]);
    } else {
      SetCurrentResource(resources[0]);
    } // if
  } // if

  SelectEditor("ResourceEditor");
}


function EditNextCell(dir)
{
  var button = GetCurrentButton();

  if (button == null) {
    return;
  } // if

  var cells = button.cells;
  var n = cells.length;

  if (n == 0) {
    SetCurrentCell(null);
    return;
  } // if

  var found = 0;
  var cell = GetCurrentCell();
  if (cell != null) {

    var i;
    for (i = 0; i < n; i++) {
      if (cells[i] == cell) {
        if (dir < 0) {
          if (i == 0) {
            i = n - 1;
          } else {
            i--;
          } // if
        } else {
          if (i == n - 1) {
            i = 0;
          } else {
            i++;
          } // if
        } // if
        SetCurrentCell(cells[i]);
        found = 1;
        break;
      } // if
    } // for i

  } // if

  if (!found) {
    if (dir < 0) {
      SetCurrentCell(cells[n - 1]);
    } else {
      SetCurrentCell(cells[0]);
    } // if
  } // if

  SelectEditor("CellEditor");
}


function EditNextButton(dir, edit)
{
  var gui = GetCurrentGui();

  if (gui == null) {
    return;
  } // if

  var buttons = gui.buttons;
  var n = buttons.length;

  if (n == 0) {
    SetCurrentButton(null);
    return;
  } // if

  var found = 0;
  var button = GetCurrentButton();
  if (button !== null) {

    var i;
    for (i = 0; i < n; i++) {
      if (buttons[i] == button) {
        if (dir < 0) {
          if (i == 0) {
            i = n - 1;
          } else {
            i--;
          } // if
        } else {
          if (i == n - 1) {
            i = 0;
          } else {
            i++;
          } // if
        } // if
        SetCurrentButton(buttons[i]);
        found = 1;
        break;
      } // if
    } // for i

  } // if

  if (!found) {
    if (dir < 0) {
      SetCurrentButton(buttons[n - 1]);
    } else {
      SetCurrentButton(buttons[0]);
    } // if
  } // if

  if (edit) {
    SelectEditor("ButtonEditor");
  } else {
    SelectEditor("CellIndex");
  } // if
}


function EditNextGui(dir, edit)
{
  var skin = GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  var guis = skin.guis;
  var n = guis.length;

  if (n == 0) {
    //SetCurrentGui(null);
    return;
  } // if

  var found = 0;
  var newgui = null;
  var gui = GetCurrentGui();
  if (gui != null) {

    var i;
    for (i = 0; i < n; i++) {
      if (guis[i].name == gui.title) {
        if (dir < 0) {
          if (i == 0) {
            i = n - 1;
          } else {
            i--;
          } // if
        } else {
          if (i == n - 1) {
            i = 0;
          } else {
            i++;
          } // if
        } // if
        newgui = guis[i];
        found = 1;
        break;
      } // if
    } // for i

  } // if

  if (!found) {
    if (dir < 0) {
      newgui = guis[n - 1];
    } else {
      newgui = guis[0];
    } // if
  } // if

  if (newgui != null) {
    Gui.GotoGui(newgui.name);
    if (edit) {
      SelectEditor("GuiEditor");
    } else {
      SelectEditor("ButtonIndex");
    } // if
  } // if
}


function EditNextSkin(dir, edit)
{
  var n = Skins.length;

  if (n == 0) {
    SetCurrentSkin(null, 0, -4);
    return;
  } // if

  if (n == 1) {
    return;
  } // if

  Gui.ClearCurrentGui();

  var skin = GetCurrentSkin();

  var found = 0;
  if (skin !== null) {

    var i;
    for (i = 0; i < n; i++) {
      if (Skins[i] == skin) {
        if (dir < 0) {
          if (i == 0) {
            i = n - 1;
          } else {
            i--;
          } // if
        } else {
          if (i == n - 1) {
            i = 0;
          } else {
            i++;
          } // if
        } // if
        SetCurrentSkin(Skins[i], 0, -5);
        found = 1;
        break;
      } // if
    } // for i

  } // if

  if (!found) {
    if (dir < 0) {
      SetCurrentSkin(Skins[n - 1], 0, -6);
    } else {
      SetCurrentSkin(Skins[0], 0, -7);
    } // if
  } // if

  if (edit) {
    SelectEditor("SkinEditor");
  } else {
    SelectEditor("GuiIndex");
  } // if
}


function GetObjectFromElement(el, type)
{
  while (el != null) {
    if ((el._target != null) &&
        (el._type == type)) {
      return el._target;
    } // while
    el = el.parentNode
  } // while
  return null;
}


function FindTargetTypeFromElement(el)
{
  while (el != null) {
    if (el._target != null) {
       return [el._target, el._type];
    } // while
    el = el.parentNode
  } // while
  return null;
}


function MakeBandTiles(
  skin,
  look,
  bands,
  hires,
  buttonx, buttony, buttonwidth, buttonheight)
{
  var scale =
    hires ? 1 : 2;
  var xray =
    XRayMode;

  var result =
    "<TABLE width='" +
    buttonwidth +
    "' height='" +
    buttonheight +
    "' style='display: block ; position: absolute" +
    " ; left: " + buttonx +
    " ; top: " + buttony +
    " ; behavior: url(#ConnectedSkinBehavior)" +
    "' states='1' state='0' edge='1'" +
    " scale='" + scale + "'" +
    " xray='" + xray + "'" +
    "' border='0' cellpadding='0' cellspacing='0'>\n";

  if (XRayMode) {
    result += "<tr height='100%'><td width='100%'>&nbsp;</td></tr>";
  } else {

    var y = 0;
    while ((bands > 0) && (y < buttonheight)) {
      var res =
        skin.GetResource("Tbmp", look);
      if (res == null) {
        break;
      } // if

      result +=
        "<TR><TD style='background-image: url(" + res.fullurl +
        ")' width='" + res.width +
        "' height='" + res.height +
        "'/></TR>\n";

      look++;
      y += res.height;
      bands--;
    } // while

  } // if

  result +=
    "</TABLE>\n";

  return result;
}


function OldMakeStretchTiles(
  skin, imageurl, imagewidth, imageheight,
  hires, stretch, states, state,
  buttonx, buttony, buttonwidth, buttonheight)
{
  var result =
    "<TABLE width='" +
    buttonwidth +
    "' height='" +
    buttonheight +
    "' style='display: block ; position: absolute" +
    " ; left: " + buttonx +
    " ; top: " + buttony +
    "' border='0' cellpadding='0' cellspacing='0'>\n";

  var statewidth = Math.floor(imagewidth / states);
  var stateheight = imageheight;
  var middlew = statewidth - (2 * stretch);
  var middleh = stateheight - (2 * stretch);
  var cw = 1, ch = 1;
  var bgposx, bgposy;
  var x, y;
  var dx = -(state * statewidth);
  var dy = 0;

  for (y = 0; y < buttonheight; y += ch) {

    result +=
      "<TR>\n";

    if (y == 0) {
      // top
      ch = stretch;
      bgposy = 0 + dy;
    } else if (y < (buttonheight - stretch)) {
      // center
      var space = ((buttonheight - stretch) - y);
      if (space < middleh) {
        ch = space;
      } else {
        ch = middleh;
      } // if
      // Note: Impose a minimum size for the center tile of 8x8.
      if (ch < 8) {
        ch = 8;
      } // if
      bgposy = -stretch + dy;
    } else {
      // bottom
      ch = stretch;
      bgposy = -(stateheight - stretch) + dy;
    } // if

    for (x = 0; x < buttonwidth; x += cw) {

      if (x == 0) {
        // left
        cw = stretch;
        bgposx = 0 + dx;
      } else if (x < (buttonwidth - stretch)) {
        // center
        var space = ((buttonwidth - stretch) - x);
        if (space < middlew) {
          cw = space;
        } else {
          cw = middlew;
        } // if
        // Note: Impose a minimum size for the center tile of 8x8.
        if (cw < 8) {
          cw = 8;
        } // if
        bgposx = -stretch + dx;
      } else {
        // right
        cw = stretch;
        bgposx = -(statewidth - stretch) + dx;
      } // if

      result +=
        "<TD style='background-image: url(" + imageurl + "); " +
        "background-position: " + bgposx +
        " " + bgposy +
        "' width='" + cw +
        "' height='" + ch +
        "'/>\n";

    } // for x

    result +=
      "</TR>\n";

  } // for y

  result +=
    "</TABLE>\n";

  return result;
}


function MakeStretchTiles(
  skin, imageurl, imagewidth, imageheight,
  hires, stretch, states, state,
  buttonx, buttony, buttonwidth, buttonheight)
{
  var scale =
    hires ? 1 : 2;
  var xray =
    XRayMode;

  var result =
    "<DIV style='display: block ; position: absolute" +
    " ; left: " + buttonx +
    " ; top: " + buttony +
    " ; width: " + buttonwidth + 
    " ; height: " + buttonheight +
    " ; behavior: url(#ConnectedSkinBehavior)" +
    "' states='" + states + "' state='" + state + "'" +
    " edge='" + stretch + "' scale='" + scale + "'" +
    " xray='" + xray + "'" +
    " image='" + imageurl + "'" +
    "/>\n";
  return result;
}


function MakeBackgroundHTML(
  skin, hires, 
  buttonx, buttony, buttonwidth, buttonheight)
{
  var scale =
    hires ? 1 : 2;
  var xray =
    XRayMode;

  var result =
    "<DIV style='display: block ; position: absolute" +
    " ; left: " + buttonx +
    " ; top: " + buttony +
    " ; width: " + buttonwidth + 
    " ; height: " + buttonheight +
    " ; behavior: url(#ConnectedSkinBehavior)" +
    "' states='1' state='0' edge='0'" +
    " scale='" + scale + "'" +
    " xray='" + xray + "'" +
    "/>\n";
  return result;
}


function GenUniqueNumber()
{
  return ++GenUniqueNumber.id;
}

GenUniqueNumber.id = 0;


function GenUniqueID(prefix)
{
  if (prefix == null) {
    prefix = "id";
  } // if
  return prefix + "_" + GenUniqueNumber();
}


function GetObjectID(obj)
{
  var id = obj._id;
  if (id == null) {
    id = GenUniqueID("obj");
    ObjectDict[id] = obj;
  } // if
  return id;
}


function ClearObjectID(obj)
{
  var id = obj._id;
  if (id != null) {
    ObjectDict[id] = null;
    obj._id = null;
  } // if
}


function GetObjectFromID(id)
{
   return ObjectDict[id];
}


function BeginOverlay(el, root)
{
  EndOverlay();
  OverlayDiv._el = el;
  OverlayDiv.filters[0].enabled = !XRayMode
  OverlayDiv.filters[1].enabled = !XRayMode
  el._originalParent = el.parentElement;
  el._originalBefore = el.nextSibling;
  root.appendChild(OverlayDiv);
  OverlayDiv.appendChild(el);
  OverlayDiv.style.display = "block";
}


function EndOverlay()
{
  var el = OverlayDiv._el;
  if (!el) {
    return;
  } // if
  OverlayDiv.style.display = "none";
  el._originalParent.insertBefore(el, el._originalBefore);
  el._originalParent = null;
  el._originalBefore = null;
  OverlayDiv._el = null;
}


function FindContext()
{
  var event = window.event;
  return FindContextFromElement(
    event.srcElement);
//    EventSource);
}


function FindContextFromElement(el)
{
  var context = Object();

  if (el == null) {
    context.NULLELEMENT = 1;
    return context;
  } // if

  var els = "";

  while ((el != null) &&
         (el.nodeName != "#document")) {

    els += el.nodeName + "[" + el.id + "] ";

    if ((context.schema == null) &&
        (el._schemaid != null)) {
      context.schema = GetObjectFromID(el._schemaid);
    } // if

    if ((context.att == null) &&
        (el._attid != null)) {
      context.att = GetObjectFromID(el._attid);
    } // if

    if ((context.obj == null) &&
        (el._objid != null)) {
      context.obj = GetObjectFromID(el._objid);
    } // if

    if ((context.row == null) &&
        (el._row != null)) {
      context.row = el;
    } // if

    if ((context.column == null) &&
        (el._column != null)) {
      context.column = el;
    } // if

    if ((context.table == null) &&
        (el._table != null)) {
      context.table = el;
    } // if

    if ((context.view == null) &&
        (el._view != null)) {
      context.view = el;
    } // if

    if ((context.target == null) &&
        (el._target != null)) {
      context.target = el._target;
    } // if

    if ((context.type == null) &&
        (el._type != null)) {
      context.type = el._type;
    } // if

    if (el.id == "EditorContainer") {
      break;
    } // if

    el = el.parentNode;

  } // while

  context.els = els;

  return context;
}


function DoUpdateAttributeString()
{
  var event = window.event;
  var input = event.srcElement;
  var val = input.value;

  var ctx = FindContext();
  var obj = ctx.obj;

  obj[ctx.att.name] = val;

  obj.Damage();
}


function DoUpdateAttributeFont()
{
  var event = window.event;
  if (event == null) {
    return;
  } // if
  var input = 
    event.srcElement;
  if (input.nodeName != "INPUT") {
    return;
  } // if
  var val = input.value;

  var ctx = 
    FindContext();

  var obj = ctx.obj;

  obj[ctx.att.name] = val;

  obj.Damage();
}


function DoUpdateAttributeColor()
{
  var event = window.event;
  var input = event.srcElement;
  var val = input.value;
  var ctx = FindContext();

  var obj = ctx.obj;

  obj[ctx.att.name] = val;

  obj.Damage();
}


function DoUpdateAttributeInt()
{
  var event = window.event;
  var input = event.srcElement;
  var val = input.value;

  var i = parseInt(input.value);
  if (isNaN(i)) {
    i = ParseBool(input.value, 0) ? 1 : 0;
  } // if

  input.value = "" + i;

  var ctx = FindContext();
  ctx.obj[ctx.att.name] = i;

  ctx.obj.Damage();
}


function DoUpdateAttributeFloat()
{
  var event = window.event;
  var input = event.srcElement;
  var val = input.value;

  var i = parseFloat(input.value);
  if (isNaN(i)) {
    i = 0;
  } // if

  input.value = "" + i;

  var ctx = FindContext();
  ctx.obj[ctx.att.name] = i;

  ctx.obj.Damage();
}


function DoUpdateAttributeBoolean()
{
  var event = window.event;
  var input = event.srcElement;
  var val = input.value;

  var i = ParseBool(input.checked, false);

  var ctx = FindContext();
  ctx.obj[ctx.att.name] = i;

  ctx.obj.Damage();
}


function DoUpdateAttributeCommand()
{
  var ctx = FindContext();
  var row = ctx.row;
  var cmd = FindChildElement(row, "_cmd").value;
  var args = FindChildElement(row, "_args").value;
  var str = cmd + " " + args;

  ctx.obj[ctx.att.name] = str;

  ctx.obj.Damage();
}


function DoUpdateAttributeLabelCommand()
{
  var ctx = FindContext();
  var row = ctx.row;
  var label = FindChildElement(row, "_label").value;
  var cmd = FindChildElement(row, "_cmd").value;
  var args = FindChildElement(row, "_args").value;
  var str = label + ":" + cmd + " " + args;

  ctx.obj[ctx.att.name] = str;

  ctx.obj.Damage();
}


function MakeSelectMenu(id, onchange, extras, options, cur)
{
  if (id == null) {
    id = "";
  } // if

  if (onchange == null) {
    onchange = "";
  } // if

  var str =
    "<SELECT id=\"" + id + "\" onchange=\"" + onchange + "\">";

  var phase;
  for (phase = 0; phase < 2; phase++) {
    var opts =
      phase ? options : extras;
    if (opts != null) {
      var n = opts.length;
      var i;
      for (i = 0; i < n; i++) {
        var opt = opts[i];
        var selected = 
          (opt[0] == cur) ? " selected='1'" : "";
        str +=
          "<OPTION value='" + escape(opt[0]) + "'" + selected + ">" + opt[1] + "</OPTION>";
      } // for i
    } // if
  } // for phase

  str += "</SELECT>";

  return str;
}


function MakeEditorItems()
{
  var items = new Array();
  var n = EditorNames.length;
  var i;
  for (i = 0; i < n; i++) {
    var a = EditorNames[i];
    var m = a.length;
    var j;
    for (j = 1; j < m; j++) {
      var b = a[j];
      items[items.length] = [b[0], b[1]];
    } // for j
  } // for i
  return items;
}


function MakeMenus()
{
  MakeEditorMenu();
  MakePieMenus();
  return true;
}


function MakeEditorMenu()
{
  EditorSelectContainer.innerHTML = 
    MakeSelectMenu(
      "EditorSelect",
      "SelectEditor(EditorSelect.value)",
      null,
      MakeEditorItems());
}


function MakePieMenus()
{
    var xml =
      Schema.ExpandTemplate(
        "Editor_PieMenu_GuiEditor",
        null);

    MakePieMenu(
      PieDivGuiEditor,
      "Editor_PieDivGuiEditor",
      xml);
}


function MakeImageResourceItems(skin)
{
  var items = new Array();
  items[0] = ["-1", "(inherited)"];
  items[1] = ["0", "(none)"];
  var resources = skin.resources;
  var n = resources.length;
  var i;
  for (i = 0; i < n; i++) {
    var res = resources[i];
    if (res.type == "Tbmp") {
      var name = res.id + ": " + res.fullurl;
      items[items.length] = ["" + res.id, name];
    } // if
  } // for
  return items;
}


function MakeLookMenuDict(schema, att, obj, value)
{
  var skin = GetCurrentSkin();
  var body = "";
  var val =
    obj[att.name];
  var resid = 
    parseInt(
      val);
  var restype = "Tbmp";
  if (resid == -1) {
    body = "-1: (inherited)";
  } else if (resid == 0) {
    body = "0: (none)";
  } else if (resid == Math.NaN) {
    body = "NaN: (error)";
  } else {
    var res = skin.GetResource(restype, resid);
    if (res == null) {
      body = resid + ": Missing Resource";
    } else {
      var template =
        Schema.FindTemplate(
          "EditSchema_Attribute_LookView");
      body =
        template.ExpandForAtt(
          att,
          obj);
    } // if
  } // if

  var handler = 
    "DoSelectLookMenu()";
  var items =
    MakeImageResourceItems(
      skin);
  var menu =
    MakeSelectMenu(
      null, 
      handler, 
      null, 
      items, 
      value);

  return ({
    'MENU': menu,
    'BODY': body
  });
}


function DoSelectLookMenu()
{
  var ctx = 
    FindContext();
  var value =
    parseInt(event.srcElement.value);
  ctx.obj[ctx.att.name] = 
    value;
Log.innerText = "FOO ctx " + ctx + " obj " + ctx.obj
  ctx.obj.Damage();
  
  var body = 
    FindEventElement(
      2, 
      '_body');
  
  var template =
    Schema.FindTemplate(
      'EditSchema_Attribute_LookView');

  body.innerHTML =
   template.ExpandForAtt(
     ctx.att,
     ctx.obj);
}


function FormSelectEditSource(id)
{
  var el = event.srcElement.parentElement;
  var input = document.all[id].nextSibling;
  var inputid = input.uniqueID;
  var onchange = "FormSelectInputChange(" + inputid + ")";
  el.outerHTML =
    MakeSelectMenu(
      null,
      onchange,
      [["", "(none)"]],
      SourceNames,
      "");
}


function FormSelectInputChange(input)
{
  var event = window.event;
  input.value = event.srcElement.value;
}


function FormSelectEditCommand(id)
{
  var event = window.event;
  var el = event.srcElement.parentElement;
  var input = document.all[id].nextSibling;
  var inputid = input.uniqueID;
  var onchange = "FormSelectInputChange(" + inputid + ")";
  el.outerHTML =
    MakeSelectMenu(
      null,
      onchange,
      [["", "(none)"]],
      CommandNames,
      "");
}


function FormSelectEditLabelCommand(id)
{
  var event = window.event;
  var el = event.srcElement.parentElement;
  var input = document.all[id].nextSibling;
  var inputid = input.uniqueID;
  var onchange = "FormSelectEditLabelCommandChange(" + inputid + ")";
  el.outerHTML =
    MakeSelectMenu(
      null,
      onchange,
      [["", "(none)"]],
      CommandNames,
      "");
}


function FormSelectEditLabelCommandChange(input)
{
  var str = input.value;
  var event = window.event;
  var cmd = event.srcElement.value;
  var label = "";

  var i = str.indexOf(":");
  if (i == -1) {
    label = str;
  } else if (i > 0) {
    label = str.substr(0, i);
  } // if

  var labelcmd = label + ":" + cmd;
  if (labelcmd == ":") {
    labelcmd = "";
  } // if

  input.value = labelcmd;
}


function FormSelectEditLook(id)
{
  var event = window.event;
  var el = event.srcElement.parentElement;
  var input = document.all[id].nextSibling;
  var inputid = input.uniqueID;
  var onchange = "FormSelectEditLookChange(" + inputid + ")";
  var items = new Array();
  var skin = GetCurrentSkin();
  var resources = skin.resources;
  var n = resources.length;
  var i;
  for (i = 0; i < n; i++) {
    var res = resources[i];
    if (res.type == "Tbmp") {
      var name = res.id + ": " + res.fullurl;
      items[items.length] = name;
    } // if
  } // for
  el.outerHTML =
    MakeSelectMenu(
      null,
      onchange,
      [["-1", "-1: (inherited)"],
       ["0", "0: (none)"]],
      items,
      "");
}


function FormSelectEditLookChange(input)
{
  var event = window.event;
  input.value = event.srcElement.value.split(":")[0];
}


function GetNextElement(el, name, dir, skip)
{
  while (el != null) {

    if (el.nodeType == 1) {

      if ((name == null) ||
          (name == el.nodeName)) {

        if (skip <= 0) {
          return el;
        } // if

        skip--;

      } // if
    } // if

    if (dir < 0) {
      el = el.previousSibling;
    } else if (dir > 0) {
      el = el.nextSibling;
    } else {
      el = el.parentNode;
    } // if

  } // if

  return el;
}


function FindEventElement(outs, id)
{
  var event = window.event;
  var el = event.srcElement;
  var i;
  for (i = 0; i < outs; i++) {
    if (el == null) {
      break;
    } // if
    el = el.parentElement;
  } // for i
  var result = FindChildElement(el, id);
  return result;
}


function FindChildElement(el, id)
{
  if (el == null) {
    return null;
  } // if

  if (el.id == id) {
    return el;
  } // if

  var kid = el.firstChild;
  while (kid != null) {
    var result = 
      FindChildElement(
        kid, id);
    if (result != null) {
      return result;
    } // if
    kid = kid.nextSibling;
  } // while

  return null;
}


function FindDestColumn(el)
{
  el = GetNextElement(el, "TR", 0, 0);
  el = GetNextElement(el.firstChild, "TD", 1, 1);

  if (el == null) {
    Notice.innerHTML += "<HR/>Could not find TD!<HR/>";
    LoadError = 15;
    return;
  } // if

  return el;
}


function MakePieMenu(el, wrapper, xml)
{
  var txt =
    Schema.ExpandTemplate(
      wrapper, {
        "_PIEMENU_": xml
      });

  el.innerHTML = txt;
}


function DestroyPieMenu(pie)
{
  pie.outerHTML = "";
}


function ClickAttributeLabel()
{
  var context = FindContext();
  var row = context.row;
  var schema = context.schema;
  var att = context.att;
  var obj = context.obj;
  var event = window.event;
  EventSource = context.column; // event.srcElement;

  var col = 
    FindDestColumn(event.srcElement);

  if (col != null) {
    // Select an editor.
    var types = att.edittypes;
    var typecount = types.length;

    var items = "";
    var i;
    for (i = 0; i < typecount; i++) {
      items += "<item name='" + types[i] + "'/>";
    } // for i

    var piemenustr =
      Schema.ExpandTemplate(
        "Editor_PieMenu_AttributeEditor", {
          "_ITEMS_": items
        });

    MakePieMenu(
      PieDivAttributeEditor,
      "Editor_PieDivAttributeEditor",
      piemenustr);
    var pie =
      Editor_PieDivAttributeEditor;

    //pie.eventsource = EventSource;

    pie.DoSelect = function() {
      var item = pie.rootpiemenu.curItem;
      if ((item >= 0) &&
          (item < typecount)) {
        att.edittypeindex = item;
        var sss = 
          Schema.MakeAttEditor(
            schema,
            att,
            obj);
        col.innerHTML =
          sss;
      } // if
      DestroyPieMenu(pie);
    };
  } // if
}


function GetCommandArgs(cmd)
{
  var args = "";
  var i;
  var n = CommandNames.length;
  for (i = 0; i < n; i++) {
    var cn = CommandNames[i];
    if (cn[0] == cmd) {
      return cn[2];
      break;
    } // if
  } // for i
  return args;
}


function CancelRepairTimer()
{
  if (RepairTimer != null) {
    window.clearTimeout(RepairTimer);
    RepairTime = null;
  } // if
}


function StartRepairTimer()
{
  CancelRepairTimer();
  RepairTimer = window.setTimeout("RepairCurrentViews()", RepairDelay);
}


function RepairCurrentViews()
{
  var skin = 
    GetCurrentSkin();
  if (skin) {
    skin.Repair();
  } // if
}


function CreateNewSkin()
{
  var name = FindEventElement(2, "_name").value;
  var base = FindEventElement(2, "_base").value;
  var msg = FindEventElement(2, "_msg");

  msg.innerHTML = "";

  if (name == "") {
    msg.innerHTML +=
      "Please enter a Skin name.<BR/>";
    return;
  } // if

  if (base == "") {
    msg.innerHTML +=
      "Please enter a Skin base directory.<BR/>";
    return;
  } // if

  var n = Skins.length;
  var i;
  for (i = 0; i < n; i++) {
    var skin = Skins[i];
    if (skin.name == name) {
      msg.innerHTML += 
        "A Skin with the same name '" + name + "' already exists.<BR/>" +
        "<SPAN class='CommandButton' command='SelectEditor(\"SkinEditor\")'>Edit Skin</SPAN>.<BR/>";
      SetCurrentSkin(skin, 1, -8);
      return;
    } // if
    if (skin.base == base) {
      msg.innerHTML += 
        "A Skin with the same base '" + base + "' already exists.<BR/>" +
        "<SPAN class='CommandButton' command='SelectEditor(\"SkinEditor\")'>Edit Skin</SPAN>.<BR/>";
      SetCurrentSkin(skin, 1, -9);
      return;
    } // if
  } // for i
  
  var newfolder = 
    StripFilePrefix(EditorBase) + "/" + base;

  var newfolderimages =
    newfolder + "/Images";
  var newfolderxml =
    newfolder + "/XML";

  var skinurl =
    "XML/Skin.xml"
  var newfileskin =
    newfolder + "/" + skinurl;

  var resourceurl =
    "XML/Resources.xml"
  var newfileresources =
    newfolder + "/" + resourceurl;

  if (!FileSystem.FolderExists(newfolder)) {
    try {
      FileSystem.CreateFolder(
        newfolder);
    } catch(e) {
      msg.innerHTML += 
        "Could not create the folder '" + newfolder + "'.<BR/>";
      return;
    } // try
  } // if

  if (!FileSystem.FolderExists(newfolderimages)) {
    try {
      FileSystem.CreateFolder(
        newfolderimages);
    } catch(e) {
      msg.innerHTML += 
        "Could not create the folder '" + newfolderimages + "'.<BR/>";
      return;
    } // try
  } // if

  if (!FileSystem.FolderExists(newfolderxml)) {
    try {
      FileSystem.CreateFolder(
        newfolderxml);
    } catch(e) {
      msg.innerHTML += 
        "Could not create the folder '" + newfolderxml + "'.<BR/>";
      return;
    } // try
  } // if

  if (!FileSystem.FileExists(newfileskin)) {
    var xml =
      "<skin\n" +
      "  name=\"" + name + "\"\n" +
      "  base=\"" + base + "\"\n" +
      "  resourceurl=\"" + resourceurl + "\"\n" +
      ">\n\n" +
      "  " + CopyrightComment + "\n\n";
      "</skin>\n";
    try {
      FileSystem.CreateTextFile(
        newfileskin,
        true);
      var f =
        FileSystem.OpenTextFile(
          newfileskin,
          ForWriting,
          true);
      f.Write(
        xml);
      f.Close();
    } catch(e) {
      msg.innerHTML += 
        "Could not create text file '" + newfileskin + "'.<BR/>";
      return;
    } // try
  } // if

  if (!FileSystem.FileExists(newfileresources)) {
    var xml =
      "<?xml version='1.0'?>\n" +
      "<?xml-stylesheet type=\"text/xsl\" href=\"Resources.xsl\" ?>\n" +
      "<resources>\n" +
      "</resources>\n";
    try {
      FileSystem.CreateTextFile(
        newfileresources, true);
      var f =
        FileSystem.OpenTextFile(
          newfileresources,
          ForWriting,
          true);
      f.Write(
        xml);
      f.Close();
    } catch(e) {
      msg.innerHTML += 
        "Could not create text file '" + newfileresources + "'.<BR/>";
      return;
    } // try
  } // if

  var url =
    base + "/" + skinurl;

  var skin =
    new Skin(
      null,
      url);

  skin.InitNew(
    name,
    base,
    resourceurl);

  Skins[Skins.length] = skin;

  skin.Save();
  SaveSkins();

  SetCurrentSkin(skin, 0, -10);
  SelectEditor('SkinEditor');
}


function CreateNewGui()
{
  var skin =
    GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  var title = FindEventElement(2, "_title").value;
  var resid = parseInt(FindEventElement(2, "_resid").value);
  var msg = FindEventElement(2, "_msg");

  msg.innerHTML = "";

  if (title == "") {
    msg.innerHTML +=
      "Please enter a Gui title.<BR/>";
    return;
  } // if

  if (isNaN(resid)) {
    msg.innerHTML +=
      "Please enter a Resource id.<BR/>";
    return;
  } // if

  var filename =
    title.replace(
      /[^A-Za-z0-9]*/g,
      "");
  var url =
    "XML/Gui" + filename + ".xml";

  var res =
    skin.GetResource(
      "xBIN",
      resid);

  if (res == null) {
    res =
      skin.NewResource(
        "xBIN",
        resid,
        url);
    var fullurl =
      res.fullurl;
    var path =
      StripFilePrefix(
        fullurl);
    if (!FileSystem.FileExists(path)) {
      var xml =
        "<gui\n" +
        "  title=\"" + title + "\"\n" +
        "  width=\"160\"\n" +
        "  height=\"160\"\n" +
        "  onback=\"\"\n" +
        "  cachetype=\"0\"\n" +
        ">\n\n" +
        "  " + CopyrightComment + "\n\n" +
        "</gui>\n";
      try {
        FileSystem.CreateTextFile(
          path, true);
        var f =
          FileSystem.OpenTextFile(
            path,
            ForWriting,
            true);
        f.Write(
          xml);
        f.Close();
      } catch(e) {
        msg.innerHTML += 
          "Could not create text file '" + path + "'.<BR/>";
        return;
      } // try
    } // if
  } // if

  var guis = 
    skin.guis;
  var n = guis.length;
  var i;
  for (i = 0; i < n; i++) {
    var gui = guis[i];
    if (gui.name == title) {
      msg.innerHTML += 
        "A Gui with the same title '" + title + "' already exists.<BR/>" +
        "<SPAN class='CommandButton' command='SelectEditor(\"GuiEditor\")'>Edit Gui</SPAN>.<BR/>";
      SetCurrentGui(gui, 1);
      return;
    } // if
    if (gui.url == url) {
      msg.innerHTML += 
        "A Gui with the same url '" + url + "' already exists.<BR/>" +
        "<SPAN class='CommandButton' command='SelectEditor(\"GuiEditor\")'>Edit Gui</SPAN>.<BR/>";
      SetCurrentGui(gui, 1);
      return;
    } // if
  } // for i

  skin.MakeGuiNew(
    title,
    url);

  skin.Damage();
  skin.Save();

  msg.innerText += 
    "title '" + title + "' resid " + resid + " filename '" + filename + "'";

  Gui.GotoGui(
    title);
  SelectEditor('GuiEditor');
}


function CreateNewButton()
{
  var gui =
    GetCurrentGui();

  if (gui == null) {
    return;
  } // if

  var pos = FindEventElement(2, "_pos").value;
  var msg = FindEventElement(2, "_msg");

  msg.innerHTML = "";

  var button =
    new Button(gui, null);

  // Initialize button position. TODO: Cascade.
  button.x = 50;
  button.y = 50;
  button.width = 50;
  button.height = 50;

  var buttons =
    gui.buttons;

  var sib =
    buttons[pos];
  button.MoveBefore(
    sib);

  button.Damage();

  SetCurrentButton(button);
  SelectEditor('ButtonEditor');
}


function CreateNewCell()
{
  var button = GetCurrentButton();

  if (button == null) {
    return;
  } // if

  var pos = FindEventElement(2, "_pos").value;
  var msg = FindEventElement(2, "_msg");

  msg.innerHTML = "";

  var cell =
    new Cell(button, null);

  var cells =
    button.cells;

  var sib =
    cells[pos];
  cell.MoveBefore(
    sib);

  var n = cells.length;
  var rows = button.rows;
  var columns = button.columns;
  var cellcount = button.rows * button.columns;
  if (cellcount < n) {
    if (rows == 1) {
      columns = n;
    } else if (columns == 1) {
      rows = n;
    } else {
      if (button.rowlayout) {
        columns = Math.ceil(n / rows);
      } else {
        rows = Math.ceil(n / columns);
      } // if
    } // if
    button.rows = rows;
    button.columns = columns;
  } // if

  button.Damage();

  SetCurrentCell(cell);
  SelectEditor('CellEditor');
}


function CreateNewResource()
{
  var skin = GetCurrentSkin();
  if (skin == null) {
    return;
  } // if

  var restype = FindEventElement(2, "_restype").value;
  var resid = parseInt(FindEventElement(2, "_resid").value);
  var resfile = FindEventElement(2, "_resfile").value;
  var rescmd = FindEventElement(2, "_rescmd").value;
  var rescompress = FindEventElement(2, "_rescompress").value;
  var msg = FindEventElement(2, "_msg");
  var img = FindEventElement(2, "_img");

  msg.innerHTML = "";

  if (isNaN(resid)) {
    msg.innerHTML +=
      "Invalid resource ID. Please enter a number.<BR/>";
    return;
  } // if

  var res = skin.GetResource(restype, resid);
  if (res != null) {
    msg.innerHTML += 
      "A Resource of type '" + restype + "' with id " + resid + " already exists.<BR/>" +
      "<SPAN class='CommandButton' command='SelectEditor(\"ResourceEditor\")'>Edit Resource</SPAN>.<BR/>";
    SetCurrentResource(res, 1);
    return;
  } // if

  if (resfile == "") {
    msg.innerHTML +=
      "Invalid resource file name. Please select an existing file.<BR/>";
    return;
  } // if

  var base =
    EditorBase + "/" + skin.base;
  var chopbase = 
    base;
  var skinsstr = "/Skins/";
  var skinsindex =
    chopbase.toLowerCase().indexOf(skinsstr.toLowerCase());
  if (skinsindex == -1) {
    msg.innerHTML +=
      "Can't find '" + skinsstr + "' base in resource file path.<BR/>";
    return;
  } // if

  chopbase = 
    chopbase.substr(
      skinsindex);

  chopbase = chopbase + "/";
  resfile = resfile.replace(/\\/g, "/");

  var baseindex = 
    resfile.toLowerCase().indexOf(chopbase.toLowerCase());
  if (baseindex == -1) {
    msg.innerHTML +=
      "Invalid resource file name. Please select an existing file inside the Skin directory '" +
      base + "'.<BR/>";
    return;
  } // if

  var relpath =
    resfile.substr(
      baseindex + chopbase.length);

  msg.innerHTML = 
    "Creating resource type '" + restype +
    "' id '" + resid +
    "', relative to base '" + base + "', " +
    "' from filename '" + relpath + "'.<BR/>" +
    "<SPAN class='CommandButton' command='SelectEditor(\"ResourceEditor\")'>Edit Resource</SPAN>.<BR/>";

  var res =
    skin.NewResource(
      restype, 
      resid, 
      relpath);

  if (restype == "Tbmp") {
    // Figure out the image size from the html IMG element. 
    // (And you thought it was just for show and tell.)
    var width = img.width;
    var height = img.height;
    res.InitImage(
      rescmd,
      rescompress,
      width,
      height);
  } else if (restype == "xBIN") {
    res.InitXML();
  } else {
    // Unknown resource type.
  } // if

  SaveCurrentSkin();

  SetCurrentResource(res);
  SelectEditor('ResourceEditor');
}


function DoSelectResourceFileOrType()
{
  var restype = FindEventElement(3, "_restype").value;
  var resid = FindEventElement(3, "_resid");
  var resfile = FindEventElement(3, "_resfile").value;
  var img = FindEventElement(3, "_img");
  var cmdrow = FindEventElement(3, "_cmdrow");
  var compressrow = FindEventElement(3, "_compressrow");
  var imgrow = FindEventElement(3, "_imgrow");
  
  if (restype == "Tbmp") {
    cmdrow.style.display = "inline";
    compressrow.style.display = "inline";
    if (resfile == "") {
      imgrow.style.display = "none";
    } else {
      imgrow.style.display = "inline";
      img.src = resfile;
    } // if
    resid.value = GetNextImageResourceID();
  } else if (restype == "xBIN") {
    cmdrow.style.display = "none";
    compressrow.style.display = "none";
    imgrow.style.display = "none";
    resid.value = GetNextXMLResourceID();
  } // if
}


function DeleteResourceReally()
{
  var res = GetCurrentResource();
  
  if (res == null) {
    return;
  } // if

  var skin = res.skin;
  var resources = skin.resources;
  var resourcesdict = skin.resourcesdict;
  var id = res.id;
  var type = res.type;
  var key = type + id;
  delete resourcesdict[key];
  var newresources = new Array();
  var n = resources.length;
  var i;
  for (i = 0; i < n; i++) {
    var r = resources[i];
    if (r != res) {
      newresources[newresources.length] = r;
    } // if
  } // for i
  skin.resources = newresources;
  res.Destroy();
  if (newresources.length == 0) {
    SetCurrentResource(null);
  } else {
    SetCurrentResource(newresources[0]);
  } // if

  SaveCurrentSkin();

  SelectEditor("ResourceIndex");
}


function DeleteSkinReally()
{
  var skin = GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  var n = Skins.length;
  var i;
  for (i = 0; i < n; i++) {
    var s = Skins[i];
    if (s == skin) {
      Skins.splice(
        i,
        1);
      skin.Destroy();
      break;
    } // if
  } // for i

  SaveSkins();

  var guiname = "";
  if (n == 1) {
    SetCurrentSkin(null, 0, -11);
  } else {
    var newskin = Skins[0]
    var guis = newskin.guis;
    if (guis.length > 0) {
      guiname = guis[0].name;
    } // if
    SetCurrentSkin(newskin, 0, -12);
  } // if

  Gui.GotoGui(
    guiname);

  SelectEditor("SkinIndex");
}


function DeleteGuiReally()
{
  var gui = GetCurrentGui();

  if (gui == null) {
    return;
  } // if

  var title = gui.title;
  var skin = gui.skin;
  var guis = skin.guis;
  var n = guis.length;
  var i;
  for (i = 0; i < n; i++) {
    var g = guis[i];
    if (g.name == title) {
      guis.splice(
        i,
        1);
      gui.Destroy();
      break;
    } // if
  } // for i

  var guiname = "";
  if (n > 1) {
    guiname = guis[0].name;
  } // if

  Gui.GotoGui(
    guiname);

  skin.Damage();
  skin.Save();

  SelectEditor("GuiIndex");
}


function DeleteButtonReally()
{
  var button = GetCurrentButton();

  if (button == null) {
    return;
  } // if

  var gui = button.gui;
  var buttons = gui.buttons;
  var n = buttons.length;
  var i;
  for (i = 0; i < n; i++) {
    var b = buttons[i];
    if (b == button) {
      buttons.splice(
        i,
        1);
      button.Destroy();
      break;
    } // if
  } // for i

  if (n > 1) {
    SetCurrentButton(buttons[0]);
  } else {
    SetCurrentButton(null);
  } // if

  gui.Damage();

  SelectEditor("ButtonIndex");
}


function DeleteCellReally()
{
  var cell = GetCurrentCell();

  if (cell == null) {
    return;
  } // if

  var button = cell.button;
  var cells = button.cells;
  var n = cells.length;

  // Can't delete the last cell.
  if (n <= 1) {
    return;
  } // if

  var i;
  for (i = 0; i < n; i++) {
    var c = cells[i];
    if (c == cell) {
      cells.splice(
        i,
        1);
      cell.Destroy();
      break;
    } // if
  } // for i

  SetCurrentCell(cells[0]);

  var n = cells.length;
  var rows = button.rows;
  var columns = button.columns;
  var cellcount = button.rows * button.columns;

  if (rows == 1) {
    columns = n;
  } else if (columns == 1) {
    rows = n;
  } else {
    if (button.rowlayout) {
      columns = Math.ceil(n / rows);
    } else {
      rows = Math.ceil(n / columns);
    } // if
  } // if
  button.rows = rows;
  button.columns = columns;

  button.Damage();

  SelectEditor("CellIndex");
}


function DoOnSelectStart()
{
  var event = window.event;
  var el = event.srcElement;
  while ((el != null) &&
         (el.nodeName != "#document")) {
    if (el.isselectable) {
      return true;
    } // if

    el = el.parentElement;
  } // if

  return false;
}


function StripFilePrefix(path)
{
  if (path.substr(0, 7).toLowerCase() == "file://") {
    path = 
      path.substr(7);
  } // if

  return path;
}


function LoadGlobals()
{
  var template =
    Schema.FindTemplate(
      "Application_Globals");
  if (template == null) {
    Notice.innerHTML += 
      "<HR/>Unable to load Application_Globals template from schema.</HR>";
    return false;
  } // if

  var globs =
    template.el;
  if (globs == null) {
    Notice.innerHTML += 
      "<HR/>Unable to find globals element in schema.</HR>";
    return false;
  } // if

  var kid = 
    globs.firstChild;
  while (kid != null) {
    if ((kid.nodeType == 1) &&
        (kid.nodeName == "global")) {
      var globtype =
        GetAttStr(
          kid,
          "name",
          "");
      var globname =
        GetAttStr(
          kid,
          "name",
          "");
      if (globname != "") {
        var txt = "";
        var el =
          kid.firstChild;
        while (el != null) {
          if (el.nodeType == 3) {
            txt += el.text;
          } // if
          el = el.nextSibling;
        } // while
        var newval =
          eval(txt);
        var cmd =
          globname + " = newval;"
        eval(
          cmd);
      } // if
    } // if
    kid = kid.nextSibling;
  } // while

  return true;
}


function LoadRoot()
{
  var template = 
    Schema.FindTemplate(
      "Application_Root");

  if (template == null) {
    Notice.innerHTML += 
      "<HR/>Can't find Application_Root template!<HR/>";
    return false;
  }

  var html =
    template.Expand(
      null);

  // Preserve the Log and Notice.
  var log = Log;
  var notice = Notice;
  Log.removeNode(true);
  Notice.removeNode(true);

  RootSite.innerHTML =
    html;

  // Restore them to their rightful places.
  LogContainer.appendChild(log);
  NoticeContainer.appendChild(notice);

  return true;
}


function SaveSkins()
{
  if (!EnableWriting) {
    return;
  } // if

  var str =
    "<skins\n" +
    "  base=\"" + EditorBaseRelative + "\"\n" +
    ">\n\n" +
    "  " + CopyrightComment + "\n\n";

  var gui = GetCurrentGui();
  var n = Skins.length;
  var i;
  for (i = 0; i < n; i++) {
    var skin = 
      Skins[i];

    skin.Save();

    if ((gui != null) &&
        (gui.skin == skin)) {
      gui.Save();
    } // if

    str += 
      "  <skin\n" +
      "    name=\"" + skin.name + "\"\n" +
      "    url=\"" + skin.url + "\"\n" +
      "  />\n\n";
  } // for i

  str += 
    "</skins>\n";

  var filename = 
    FileSystem.GetAbsolutePathName(
      SkinsURL);

  var saved =
    SaveStringToFile(
      str,
      filename);
}


function SaveStringToFile(
  str,
  filename)
{
  var newfilename = 
    filename + "+";
  var backupfilename = 
    filename + "~";

  try {
    FileSystem.DeleteFile(
      newfilename,
      false);
  } catch(e) {
  } // try

  try {
    FileSystem.CreateTextFile(
      newfilename,
      true);
  } catch(e) {
    Log.innerText =
      "Could not create the text file '" + newfilename + "'.";
    return false;
  } // try

  var f = null;

  try {
    f =
      FileSystem.OpenTextFile(
        newfilename,
        ForWriting,
        true);
  } catch(e) {
    Log.innerText =
      "Could not open the text file '" + newfilename + "'.";
    return false;
  } // try

  try {
    f.Write(
      str);
  } catch(e) {
    Log.innerText =
      "Could not write to the text file '" + newfilename + "'.";
    return false;
  } // try

  try {
    f.Close();
  } catch(e) {
    Log.innerText =
      "Could not close the text file '" + newfilename + "'.";
    return false;
  } // try

  try {
    FileSystem.DeleteFile(
      backupfilename,
      false);
  } catch(e) {
  } // try

  try {
    FileSystem.MoveFile(
      filename,
      backupfilename);
  } catch(e) {
    Log.innerText =
      "Could not move the old text file '" + filename + "' to '" + backupfilename + "'.";
    return false;
  } // try

  try {
    FileSystem.MoveFile(
      newfilename,
      filename);
  } catch(e) {
    Log.innerText =
      "Could not move the new text file '" + newfilename + "' to '" + filename + "'.";
    return false;
  } // try

  return true;
}


function SaveCurrentGui()
{
  var gui =
    GetCurrentGui();

  if (gui == null) {
    return;
  } // if

  gui.Save();
}


function SaveCurrentSkin()
{
  var skin =
    GetCurrentSkin();

  if (skin == null) {
    return;
  } // if

  skin.Save();
}


////////////////////////////////////////////////////////////////////////


// HEY EMACS!!!
// Local Variables:
// mode: indented-text
// indent-tabs-mode: nil
// End:
// GOOD EMACS.
