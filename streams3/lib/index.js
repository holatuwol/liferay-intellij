var streams3 = require('./streams3');

var getModuleFolders = streams3.getModuleFolders;
var getModuleIncludeFolders = streams3.getModuleIncludeFolders;

function createProject(portalSourceFolder, pluginSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var moduleFolders = getModuleFolders('modules', 5);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;