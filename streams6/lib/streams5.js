var highland = require('highland');
var streams2 = require('./streams2');
var streams3 = require('./streams3');
var util = require('util');

var sourceFolders = ['src'];
var resourceFolders = [];
var testSourceFolders = ['test/unit', 'test/integration'];
var testResourceFolders = [];
var webrootFolders = ['docroot'];

var getFilePath = highland.ncurry(2, streams2.getFilePath);
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;

var getFolders = streams3.getFolders;
var getModuleExcludeFolders = streams3.getModuleExcludeFolders;
var getModuleOverview = streams3.getModuleOverview;
var isValidSourcePath = highland.ncurry(2, streams3.isValidSourcePath);

var getLibraryDependency = highland.partial(getCoreDependency, 'library');
var getProjectDependency = highland.partial(getCoreDependency, 'project');

var defaultDependencyNames = {
	libraryNames: ['development', 'global'],
	projectNames: ['portal-kernel', 'portal-service', 'registry-api']
};

var customDependencyNames = {
	'portal-impl': {
		libraryNames: ['development', 'global', 'portal'],
		projectNames: ['portal-kernel', 'portal-service', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	},
	'portal-kernel': {
		libraryNames: ['development', 'global'],
		projectNames: ['registry-api']
	},
	'portal-service': {
		libraryNames: ['development', 'global'],
		projectNames: ['registry-api']
	},
	'portal-web': {
		libraryNames: ['development', 'global', 'portal'],
		projectNames: ['portal-impl', 'portal-kernel', 'portal-service', 'registry-api', 'util-bridges', 'util-java', 'util-taglib']
	}
};

function getCoreDependency(dependencyType, dependencyName) {
	return {
		type: dependencyType,
		name: dependencyName
	};
};

function getCoreDependencies(folder) {
	var dependencyNames = defaultDependencyNames;

	if (folder in customDependencyNames) {
		dependencyNames = customDependencyNames[folder];
	}

	return {
		libraryDependencies: dependencyNames.libraryNames.map(getLibraryDependency),
		projectDependencies: dependencyNames.projectNames.filter(isModuleDependencyAvailable).map(getProjectDependency)
	};
};

function getCoreDetails(folder) {
	var moduleOverview = getModuleOverview(folder);
	var moduleIncludeFolders = getCoreIncludeFolders(folder);
	var moduleExcludeFolders = getModuleExcludeFolders(moduleIncludeFolders);
	var moduleDependencies = getCoreDependencies(folder);

	var moduleDetailsArray = [moduleOverview, moduleIncludeFolders, moduleExcludeFolders, moduleDependencies];

	return moduleDetailsArray.reduce(util._extend, {});
};

function getCoreFolders() {
	var findResultFolders = getFolders('.', 0);
	var coreFolders = findResultFolders.filter(isCoreFolder);
	return coreFolders;
};

function getCoreIncludeFolders(folder) {
	var isValidSourceFolder = isValidSourcePath(folder);

	var moduleIncludeFolders = {
		sourceFolders: sourceFolders.filter(isValidSourceFolder),
		resourceFolders: resourceFolders.filter(isValidSourceFolder),
		testSourceFolders: testSourceFolders.filter(isValidSourceFolder),
		testResourceFolders: testResourceFolders.filter(isValidSourceFolder),
		webrootFolders: webrootFolders.filter(isValidSourceFolder)
	};

	return moduleIncludeFolders;
};


function isCoreFolder(folder) {
	var getPath = getFilePath(folder);

	var subfiles = ['build.xml'];
	var subfolders = ['docroot', 'src'];

	return subfiles.every(highland.compose(isFile, getPath)) &&
		subfolders.some(highland.compose(isDirectory, getPath));
};

function isModuleDependencyAvailable(dependencyName) {
	return isDirectory(dependencyName) || isDirectory(getFilePath('modules/core', dependencyName));
};

exports.getCoreDetails = getCoreDetails;
exports.getCoreFolders = getCoreFolders;
exports.getFilePath = getFilePath;
exports.isValidSourcePath = isValidSourcePath;