var cheerio = require('cheerio');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var os = require('os');
var streams2 = require('../streams2/streams2');
var streams4 = require('../streams5/streams4');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('./streams7');

var getComponentXML = streams6.getComponentXML;
var getDependenciesWithWhileLoop = streams4.getDependenciesWithWhileLoop;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryDependency = streams4.getLibraryDependency;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
var getOrderEntryElement = streams7.getOrderEntryElement;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var saveContent = streams6.saveContent;

function createProjectWorkspace(coreDetails, moduleDetails) {
	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);

	var detailsStream = highland.merge([moduleStream, coreStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();

	moduleFilesStream
		.map(getModuleXML)
		.map(getIntellijXML)
		.each(saveContent);

	projectFileStream
		.sortBy(comparators.comparing('moduleName'))
		.map(getModuleElement)
		.collect()
		.map(getModulesElement)
		.map(getWorkspaceModulesXML)
		.map(getIntellijXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getLibraryJarPaths(library) {
	if (library.group == null) {
		return [];
	}

	var jarPaths = library['jarPaths'];

	if (jarPaths != null) {
		return jarPaths;
	}

	var folderPath = library['folderPath'];

	if (folderPath == null) {
		folderPath = getLibraryFolderPath(library);

		library['folderPath'] = folderPath;
	}

	if (folderPath == null) {
		return [];
	}

	var jarName = library.name + '-' + library.version + '.jar';

	var jarPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, jarName))
		.filter(isFile);

	if (jarPaths.length == 0) {
		jarPaths = [getFilePath(folderPath, jarName)].filter(isFile);
	}

	library['jarPaths'] = jarPaths;

	processPomDependencies(library);

	return library['jarPaths'];
};

function getLibraryFolderPath(library) {
	if (library.group == null) {
		return null;
	}

	var mavenRelativePath = library.group.split('.').concat([library.name, library.version]).join('/');

	for (mavenCache of mavenCaches) {
		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (isDirectory(mavenAbsolutePath) && (getLibraryJarCount(mavenAbsolutePath) > 0)) {
			return mavenAbsolutePath;
		}
	}

	var gradleRelativePath = [library.group, library.name, library.version].join('/');

	for (gradleCache of gradleCaches) {
		var gradleAbsolutePath = getFilePath(gradleCache, gradleRelativePath);

		if (isDirectory(gradleAbsolutePath) && (fs.readdirSync(gradleAbsolutePath).length != 0)) {
			return gradleAbsolutePath;
		}
	}

	for (mavenCache of mavenCaches) {
		var mavenAbsolutePath = getFilePath(mavenCache, mavenRelativePath);

		if (isDirectory(mavenAbsolutePath) && (fs.readdirSync(mavenAbsolutePath).length != 0)) {
			return mavenAbsolutePath;
		}
	}

	return null;
};

function getLibraryJarCount(path) {
	var fileList = fs.readdirSync(path);
	var jarCount = fileList.filter(isJar).length;

	return fileList.filter(isDirectory).map(getLibraryJarCount).reduce(sum, jarCount);
};

function isJar(path) {
	return isFile(path) && path.endsWith('.jar');
};

function sum(accumulator, next) {
	return accumulator + next;
};

function getModuleXML(module) {
	return {
		fileName: getModuleIMLPath(module),
		components: [
			{
				name: 'NewModuleRootManager',
				content: getNewModuleRootManagerXML(module)
			},
			{
				name: 'FacetManager',
				content: getFacetManagerXML(module)
			}
		]
	};
};

function getNewModuleRootManagerXML(module) {
	var newModuleRootManagerXML = [streams7.getNewModuleRootManagerXML(module)];

	if (module.libraryDependencies) {
		// TODO: Perform work on module.libraryDependencies here
	}

	return newModuleRootManagerXML.join('\n');
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getNewModuleRootManagerXML = getNewModuleRootManagerXML;