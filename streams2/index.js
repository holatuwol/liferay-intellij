var streams2 = require('./streams2');

var getFilePath = streams2.getFilePath;
var getModuleFolders = streams2.getModuleFolders;

function createProject(portalSourceFolder, otherSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var portalSourceModulesRootPath = getFilePath(portalSourceFolder, 'modules');

	var moduleFolders = getModuleFolders(portalSourceFolder, portalSourceModulesRootPath, true);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;