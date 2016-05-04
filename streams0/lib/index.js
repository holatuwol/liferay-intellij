var fs = require('fs');
var shelljs = require('shelljs');
var streams4 = require('./streams4');
var streams5 = require('./streams5');
var streams8 = require('./streams8');
var streams9 = require('./streams9');

var createProjectObjectModels = streams9.createProjectObjectModels;
var createProjectWorkspace = streams9.createProjectWorkspace;
var getCoreDetails = streams5.getCoreDetails;
var getCoreFolders = streams5.getCoreFolders;
var getModuleDetails = streams4.getModuleDetails;
var getModuleFolders = streams4.getModuleFolders;
var getPluginDetails = streams5.getPluginDetails;
var getPluginFolders = streams5.getPluginFolders;

function createProject(portalSourceFolder, pluginSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	if (!shelljs.test('-d', '.idea')) {
		fs.mkdirSync('.idea');
	}

	if (!shelljs.test('-d', '.idea/libraries')) {
		fs.mkdirSync('.idea/libraries');
	}

	var coreFolders = getCoreFolders();
	var moduleFolders = getModuleFolders('modules', 5);
	var pluginFolders = getPluginFolders(portalSourceFolder, pluginSourceFolders);

	var coreDetails = coreFolders.map(getCoreDetails);
	var moduleDetails = moduleFolders.map(getModuleDetails);
	var pluginDetails = pluginFolders.map(getPluginDetails);

	createProjectWorkspace(coreDetails, moduleDetails, pluginDetails);

	process.chdir(initialCWD);
};

function createProjectObjectModels(portalSourceFolder) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var moduleFolders = getModuleFolders('modules', 5);
	var moduleDetails = moduleFolders.map(getModuleDetails);

	createProjectObjectModels(moduleDetails);

	process.chdir(initialCWD);
};

exports.createProject = createProject;
exports.createProjectObjectModels = createProjectObjectModels;