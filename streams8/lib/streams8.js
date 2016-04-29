var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');

var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getModuleElement = streams7.getModuleElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
var getModulesElement = streams7.getModulesElement;
var getModuleXML = streams7.getModuleXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var saveContent = streams6.saveContent;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	projectFileStream
		.sortBy(comparators.comparing('modulePath'))
		.map(getModuleElement)
		.collect()
		.map(getModulesElement)
		.map(getWorkspaceModulesXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

exports.createProjectWorkspace = createProjectWorkspace;