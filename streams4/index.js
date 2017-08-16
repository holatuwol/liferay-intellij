var streams2 = require('../streams2/streams2');
var streams3 = require('./streams3');
var streams4 = require('./streams4');

var getFilePath = streams2.getFilePath;
var getModuleDetails = streams4.getModuleDetails;
var getModuleFolders = streams3.getModuleFolders;

function createProject(portalSourceFolder, pluginSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	//var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');
	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules/apps/marketplace');

	var moduleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	var moduleDetails = moduleFolders.map(getModuleDetails);

	console.dir(moduleDetails, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;