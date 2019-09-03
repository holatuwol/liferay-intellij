var fs = require('fs');
var highland = require('highland');
var path = require('path');

function getFilePath(folderPath, fileName) {
	if (folderPath == '.') {
		return path.normalize(fileName).replace(/\\/g, '/');
	}
	else if (!folderPath || !fileName) {
		return undefined;
	}
	else {
		return path.normalize(path.join(folderPath, fileName)).replace(/\\/g, '/');
	}
};

function getFolders(folderPath, maxDepth) {
	var folders = [];

	if (!isDirectory(folderPath) || isSymbolicLink(folderPath) || isHidden(folderPath)) {
		return folders;
	}

	var fileNames = fs.readdirSync(folderPath);

	for (var i = 0; i < fileNames.length; i++) {
		var fileName = fileNames[i];

		var filePath = getFilePath(folderPath, fileName);

		if (isDirectory(filePath) && !isSymbolicLink(folderPath) && !isHidden(filePath)) {
			folders.push(filePath);

			if (maxDepth > 0) {
				Array.prototype.push.apply(
					folders, getFolders(filePath, maxDepth - 1));
			}
		}
	}

	return folders;
};

function getModuleFolders(portalSourceFolder, moduleSourceFolder, includeSubRepos) {
	var moduleRootPath = path.relative(portalSourceFolder, moduleSourceFolder);
	var findResultFolders = getFolders(moduleRootPath, 5);

	var moduleFolders = [];

	for (var i = 0; i < findResultFolders.length; i++) {
		if (isModuleFolder(includeSubRepos, findResultFolders[i])) {
			moduleFolders.push(findResultFolders[i]);
		}
	}

	return moduleFolders;
};

function isDirectory(path) {
	try {
		return fs.lstatSync(path).isDirectory();
	}
	catch (e) {
		return false;
	}
};

function isFile(path) {
	try {
		return fs.lstatSync(path).isFile();
	}
	catch (e) {
		return false;
	}
};

function isHidden(fileName) {
	var pos = fileName.indexOf('/');
	var firstPathElement = fileName.substring(0, pos);

	return (firstPathElement.indexOf('.') == 0) &&
		(firstPathElement != '.') &&
		(firstPathElement != '..');
};

function isModuleFolder(includeSubRepos, folder) {
	if ((folder.indexOf('/archetype-resources') != -1)) {
		return false;
	}

	if (!isFile(getFilePath(folder, 'bnd.bnd')) && !isFile(getFilePath(folder, 'package.json'))) {
		return false;
	}

	if (!isFile(getFilePath(folder, 'build.gradle'))) {
		return false;
	}

	if (!isDirectory(getFilePath(folder, 'docroot')) && !isDirectory(getFilePath(folder, 'src'))) {
		return false;
	}

	if (!includeSubRepos && isSubRepo(folder)) {
		return false;
	}

	return true;
};

function isRepoModePull(gitRepoFileContents) {
	return gitRepoFileContents.indexOf('mode = pull') != -1;
};

function isSubRepo(folder) {
	var possibleGitRepoFileLocations = ['.gitrepo', '../.gitrepo', '../../.gitrepo'];

	return possibleGitRepoFileLocations
		.map(getFilePath.bind(null, folder))
		.filter(isFile)
		.map(highland.ncurry(1, fs.getFilePath))
		.some(isRepoModePull);
};

function isSymbolicLink(path) {
	try {
		return fs.lstatSync(path).isSymbolicLink();
	}
	catch (e) {
		return false;
	}
};

exports.getFilePath = getFilePath;
exports.getFolders = getFolders;
exports.getModuleFolders = getModuleFolders;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.isHidden = isHidden;
exports.isModuleFolder = isModuleFolder;
exports.isRepoModePull = isRepoModePull;
exports.isSymbolicLink = isSymbolicLink;