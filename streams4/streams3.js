var fs = require('fs');
var path = require('path');
var streams2 = require('../streams2/streams2');
var util = require('util');

var getFilePath = streams2.getFilePath;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var isHidden = streams2.isHidden;
var isRepoModePull = streams2.isRepoModePull;
var isSymbolicLink = streams2.isSymbolicLink;

var sourceFolders = ['docroot/WEB-INF/service', 'docroot/WEB-INF/src', 'src/main/java', 'src/main/resources/archetype-resources/src/main/java'];
var resourceFolders = ['src/main/resources', 'src/main/resources/archetype-resources/src/main/resources'];
var testSourceFolders = ['src/test/java', 'src/testIntegration/java', 'test/integration', 'test/unit'];
var testResourceFolders = ['src/test/resources', 'src/testIntegration/resources'];
var webrootFolders = ['src/main/resources/META-INF/resources'];

var excludeFolderMap = {
	'docroot/WEB-INF/src': 'docroot/WEB-INF/classes',
	'src': 'classes',
	'src/main/java': 'classes',
	'src/main/resources': 'classes',
	'src/test/java': 'test-classes',
	'src/test/resources': 'test-classes',
	'src/testIntegration/java': 'test-classes',
	'src/testIntegration/resources': 'test-classes',
	'test/integration': 'test-classes',
	'test/unit': 'test-classes'
};

function getFolders(folderPath, maxDepth) {
	var folders = [];

	if (!isVisibleDirectory(folderPath)) {
		return folders;
	}

	var fileNames = fs.readdirSync(folderPath);

	var filePaths = fileNames.map(getFilePath.bind(null, folderPath));
	var visibleDirectories = filePaths.filter(isVisibleDirectory);

	for (var i = 0; i < visibleDirectories.length; i++) {
		var filePath = visibleDirectories[i];

		folders.push(filePath);

		if (maxDepth > 0) {
			Array.prototype.push.apply(
				folders, getFolders(filePath, maxDepth - 1));
		}
	}

	return folders;
};

function getModuleDependencies(folder) {
	return {
		libraryDependencies: []
	};
};

function getModuleDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleVersion = getModuleVersion(folder);
	var moduleIncludeFolders = getModuleIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(folder, moduleIncludeFolders);
	var moduleDependencies = getModuleDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleVersion, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {type: 'module'});
};

function getModuleExcludeFolders(folder, moduleIncludeFolders) {
	var moduleExcludeFolders = ['.settings', 'bin', 'build', 'tmp'];

	if (isFile(getFilePath(folder, 'package.json'))) {
		moduleExcludeFolders.push('node_modules');
	}

	if (isDirectory(getFilePath(folder, 'test/functional'))) {
		moduleExcludeFolders.push('test/functional');
	}

	for (key in moduleIncludeFolders) {
		if (moduleIncludeFolders.hasOwnProperty(key)) {
			moduleIncludeFolders[key].reduce(updateExcludeFolders, moduleExcludeFolders);
		}
	}

	return {
		excludeFolders: moduleExcludeFolders
	};
};

function getModuleFolders(portalSourceFolder, moduleSourceFolder) {
	var moduleRootPath = path.relative(portalSourceFolder, moduleSourceFolder);
	var findResultFolders = getFolders(moduleRootPath, 5);
	var moduleFolders = findResultFolders.filter(isModuleFolder);
	return moduleFolders;
};

function getModuleIncludeFolders(folder) {
	var isValidSourceFolder = isValidSourcePath.bind(null, folder);

	var moduleIncludeFolders = {
		sourceFolders: sourceFolders.filter(isValidSourceFolder),
		resourceFolders: resourceFolders.filter(isValidSourceFolder),
		testSourceFolders: testSourceFolders.filter(isValidSourceFolder),
		testResourceFolders: testResourceFolders.filter(isValidSourceFolder),
		webrootFolders: webrootFolders.filter(isValidSourceFolder)
	};

	return moduleIncludeFolders;
};

function getModuleOverview(folder) {
	return {
		moduleName: path.basename(folder),
		modulePath: folder.replace(/\\/g, '/')
	};
};

function getModuleVersion(folder) {
	var bndPath = getFilePath(folder, 'bnd.bnd');
	var packageJsonPath = getFilePath(folder, 'package.json');

	var bundleName, bundleVersion;

	if (isFile(bndPath)) {
		var bndContent = fs.readFileSync(bndPath);

		var bundleNameRegex = /Bundle-SymbolicName: ([^\r\n]+)/g;
		var bundleVersionRegex = /Bundle-Version: ([^\r\n]+)/g;

		var bundleNameMatcher = bundleNameRegex.exec(bndContent);
		var bundleVersionMatcher = bundleVersionRegex.exec(bndContent);

		return {
			bundleSymbolicName: bundleNameMatcher ? bundleNameMatcher[1] : null,
			bundleVersion: bundleVersionMatcher ? bundleVersionMatcher[1] : null
		};
	}

	if (isFile(packageJsonPath)) {
		var packageJsonContent = fs.readFileSync(packageJsonPath);

		var packageJson = JSON.parse(packageJsonContent);

		return {
			bundleSymbolicName: packageJson.name,
			bundleVersion: packageJson.version
		};
	}

	return {};
};

function isModuleFolder(folder) {
	if ((folder.indexOf('/archetype-resources') != -1) || (folder.indexOf('/gradleTest') != -1)) {
		return false;
	}

	var getPath = getFilePath.bind(null, folder);

	var requiredFiles = ['build.gradle'];
	var descriptors = ['bnd.bnd', 'package.json'];
	var sourceRoots = ['docroot', 'src'];

	var isPotentialModuleFolder = requiredFiles.map(getPath).every(isFile) &&
		descriptors.map(getPath).some(isFile) &&
		sourceRoots.map(getPath).some(isDirectory);

	if (!isPotentialModuleFolder) {
		return false;
	}

	return true;
};

function isValidSourcePath(moduleRoot, sourceFolder) {
	var sourceFolderPath = getFilePath(moduleRoot, sourceFolder);

	return isDirectory(sourceFolderPath) && !isFile(getFilePath(sourceFolderPath, '.touch'));
};

function isVisibleDirectory(filePath) {
	return isDirectory(filePath) && !isSymbolicLink(filePath) && !isHidden(filePath);
};

function readFileSync(filePath) {
	return fs.readFileSync(filePath);
};

function updateExcludeFolders(excludeFolders, includeFolder) {
	if (!(includeFolder in excludeFolderMap)) {
		return excludeFolders;
	}

	var excludeFolder = excludeFolderMap[includeFolder];

	if (excludeFolders.indexOf(excludeFolder) == -1) {
		excludeFolders.push(excludeFolder);
	}

	return excludeFolders;
};

exports.getFolders = getFolders;
exports.getModuleDetails = getModuleDetails;
exports.getModuleDependencies = getModuleDependencies;
exports.getModuleExcludeFolders = getModuleExcludeFolders;
exports.getModuleFolders = getModuleFolders;
exports.getModuleIncludeFolders = getModuleIncludeFolders;
exports.getModuleOverview = getModuleOverview;
exports.getModuleVersion = getModuleVersion;
exports.isValidSourcePath = isValidSourcePath;