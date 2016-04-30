var streams2 = require('./streams2');

var getModuleFolders = streams2.getModuleFolders;

function createProject(portalSourceFolder, pluginSourceFolders) {
	var initialCWD = process.cwd();

	process.chdir(portalSourceFolder);

	var moduleFolders = getModuleFolders('modules', 5);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;