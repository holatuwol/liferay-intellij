var streams3 = require('./streams3');

var getModuleFolders = streams3.getModuleFolders;

function createProject(workspaceFolder) {
	var initialCWD = process.cwd();

	process.chdir(workspaceFolder);

	var moduleFolders = getModuleFolders('modules', 5);

	console.dir(moduleFolders, {depth: null});

	process.chdir(initialCWD);
};

exports.createProject = createProject;