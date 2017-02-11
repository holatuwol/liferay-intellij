var highland = require('highland');
var streams6 = require('./streams6');

var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getIntellijXML = streams6.getIntellijXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
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

	detailsStream.done(function() {});
};

function getModuleGroupName(module) {
	var pos = module.modulePath.lastIndexOf('/');

	var moduleGroupName = module.modulePath.substring(0, pos);

	var pos = moduleGroupName.indexOf('modules/');

	if (pos == 0) {
		return moduleGroupName;
	}

	pos = moduleGroupName.indexOf('/modules/');

	if (pos != -1) {
		return moduleGroupName.substring(pos + 1);
	}

	pos = moduleGroupName.indexOf('/plugins/');

	if (pos != -1) {
		return moduleGroupName.substring(pos + 1);
	}

	pos = moduleGroupName.lastIndexOf('../');

	if (pos != -1) {
		moduleGroupName = moduleGroupName.substring(pos + 3);

		if (moduleGroupName == '..') {
			moduleGroupName = module.modulePath.substring(module.modulePath.lastIndexOf('/') + 1);
		}

		return moduleGroupName;
	}

	return 'portal';
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = [streams6.getNewModuleRootManagerXML(module)];

	if (module.projectDependencies) {
		// TODO: Perform work on module.projectDependencies here
	}

	return newModuleRootManagerXML.join('\n');
};

exports.createProjectWorkspace = createProjectWorkspace;