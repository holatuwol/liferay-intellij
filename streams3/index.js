var streams2 = require('../streams2/streams2');
var streams3 = require('./streams3');

var getFilePath = streams2.getFilePath;
var getModuleFolders = streams3.getModuleFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;

function createProject(portalSourceFolder, otherSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');

	var moduleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;