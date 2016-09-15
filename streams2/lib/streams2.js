var fs = require('fs');
var path = require('path');
var shelljs = require('shelljs');

var isFile = shelljs.test.bind(shelljs, '-f');
var isDirectory = shelljs.test.bind(shelljs, '-d');

function getFilePath(folderPath, fileName) {
	if (folderPath == '.') {
		return fileName;
	}
	else if (!folderPath || !fileName) {
		return undefined;
	}
	else {
		return path.join(folderPath, fileName).replace(/\\/g, '/');
	}
};

function getFolders(folderPath, maxDepth) {
	var folders = [];

	if (!isDirectory(folderPath)) {
		return folders;
	}

	var fileNames = fs.readdirSync(folderPath);

	for (var i = 0; i < fileNames.length; i++) {
		var fileName = fileNames[i];

		var filePath = getFilePath(folderPath, fileName);

		if (isDirectory(filePath) && !isHidden(filePath)) {
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

function isHidden(fileName) {
	var pos = fileName.indexOf('/');
	var firstPathElement = fileName.substring(0, pos);

	return (firstPathElement.indexOf('.') == 0) &&
		(firstPathElement != '.') &&
		(firstPathElement != '..');
};

function isModuleFolder(includeSubRepos, folder) {
	if (!isFile(getFilePath(folder, 'bnd.bnd'))) {
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

	for (var i = 0; i < possibleGitRepoFileLocations; i++) {
		var possibleGitRepoFileLocation = possibleGitRepoFileLocations[i];
		var gitRepoFilePath = getFilePath(folder, possibleGitRepoFileLocation);
		var gitRepoFileExists = isFile(gitRepoFilePath);

		if (!gitRepoFileExists) {
			continue;
		}

		var gitRepoFileContents = fs.readFileSync(gitRepoFilePath);

		if (isRepoModePull(gitRepoFileContents)) {
			return true;
		}
	}

	return false;
};

exports.getFilePath = getFilePath;
exports.getFolders = getFolders;
exports.getModuleFolders = getModuleFolders;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.isHidden = isHidden;
exports.isModuleFolder = isModuleFolder;
exports.isRepoModePull = isRepoModePull;