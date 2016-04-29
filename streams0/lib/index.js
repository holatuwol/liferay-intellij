var fs = require('fs');
var shelljs = require('shelljs');
var streams4 = require('./streams4');
var streams5 = require('./streams5');
var streams8 = require('./streams8');
var streams9 = require('./streams9');

function createProject(workspaceFolder) {
	var initialCWD = process.cwd();

	process.chdir(workspaceFolder);

	if (!shelljs.test('-d', '.idea')) {
		fs.mkdirSync('.idea');
	}

	if (!shelljs.test('-d', '.idea/libraries')) {
		fs.mkdirSync('.idea/libraries');
	}

	var coreFolders = streams5.getCoreFolders();
	var moduleFolders = streams4.getModuleFolders('modules', 5);

	var coreDetails = coreFolders.map(streams5.getCoreDetails);
	var moduleDetails = moduleFolders.map(streams4.getModuleDetails);

	streams9.createProjectWorkspace(coreDetails, moduleDetails);

	process.chdir(initialCWD);
};

function createProjectObjectModels(workspaceFolder) {
	var initialCWD = process.cwd();

	process.chdir(workspaceFolder);

	var moduleFolders = streams4.getModuleFolders('modules', 5);
	var moduleDetails = moduleFolders.map(streams4.getModuleDetails);

	streams9.createProjectObjectModels(moduleDetails);

	process.chdir(initialCWD);
};

exports.createProject = createProject;
exports.createProjectObjectModels = createProjectObjectModels;