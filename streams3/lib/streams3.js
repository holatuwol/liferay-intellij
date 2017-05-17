var fs = require('fs');
var path = require('path');
var streams2 = require('./streams2');
var util = require('util');

var getFilePath = streams2.getFilePath;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var isHidden = streams2.isHidden;
var isRepoModePull = streams2.isRepoModePull;

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

function isModuleFolder(includeSubRepos, folder) {
	if ((folder.indexOf('/archetype-resources') != -1) || (folder.indexOf('/gradleTest') != -1)) {
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

function readFileSync(filePath) {
	return fs.readFileSync(filePath);
};

exports.getModuleFolders = getModuleFolders;