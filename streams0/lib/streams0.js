var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var os = require('os');
var path = require('path');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');
var streams8 = require('./streams8');
var streams9 = require('./streams9');

var checkExportDependencies = streams9.checkExportDependencies;
var checkForGradleCache = streams9.checkForGradleCache;
var fixLibraryDependencies = streams9.fixLibraryDependencies;
var fixProjectDependencies = streams9.fixProjectDependencies;
var flatten = streams8.flatten;
var getAncestorFiles = streams7.getAncestorFiles;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getJarLibraryXML = streams9.getJarLibraryXML;
var getLibraryXML = streams9.getLibraryXML;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleXML = streams9.getModuleXML;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var setCoreBundleVersions = streams9.setCoreBundleVersions;
var setModuleBundleVersions = streams9.setModuleBundleVersions;
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;
var sortModuleAttributes = streams9.sortModuleAttributes;

var gitRoots = new Set();
var gradleCaches = streams9.gradleCaches;

function createProjectWorkspace(coreDetails, moduleDetails, pluginDetails) {
	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));
	moduleDetails.forEach(checkExportDependencies);

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

	coreDetails.forEach(checkForGitRoot);
	moduleDetails.forEach(checkForGitRoot);

	moduleDetails.forEach(checkForGradleCache);

	var homeGradleCache = getFilePath(os.homedir(), '.gradle/caches/modules-2/files-2.1');

	if (isDirectory(homeGradleCache)) {
		gradleCaches.add(homeGradleCache);
	}

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

	var moduleFilesStream = detailsStream.observe();
	var projectFileStream = detailsStream.observe();
	var libraryFilesStream = detailsStream.observe();
	var tagLibrariesStream = detailsStream.observe();

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

	libraryFilesStream = libraryFilesStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency);

	var coreLibraryFilesStream = libraryFilesStream.observe();

	coreLibraryFilesStream
		.where({'group': undefined})
		.map(getJarLibraryXML)
		.each(saveContent);

	libraryFilesStream
		.filter(keyExistsInObject('group'))
		.doto(setLibraryName)
		.map(getLibraryXML)
		.each(saveContent);

	tagLibrariesStream
		.flatMap(getTagLibraryPaths)
		.reduce({}, getTagLibraryURIs)
		.flatMap(highland.pairs)
		.sort()
		.map(getTagLibraryResourceElement)
		.collect()
		.map(getMiscXML)
		.each(saveContent);

	detailsStream.done(function() {});

	addGitVersionControlSystem();
};

function addGitVersionControlSystem() {
	var vcsXML = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project version="4">',
		'<component name="VcsDirectoryMappings">'
	];

	for (gitRoot of gitRoots) {
		var vcsRootPath = path.dirname(gitRoot);

		vcsRootPath = (vcsRootPath == '.') ? '$PROJECT_DIR$' : '$PROJECT_DIR$/' + vcsRootPath;

		var vcsXMLElement = '<mapping directory="' + vcsRootPath + '" vcs="Git" />';

		vcsXML.push(vcsXMLElement);
	}

	vcsXML.push('</component>');
	vcsXML.push('</project>');

	saveContent({
		name: '.idea/vcs.xml',
		content: vcsXML.join('\n')
	});
};

function checkForGitRoot(module) {
	if (!module.modulePath) {
		return;
	}

	var candidates = getAncestorFiles(module.modulePath, '.git');

	candidates.forEach(Set.prototype.add.bind(gitRoots));
};

function getFilePaths(folder) {
	return fs.readdirSync(folder).map(getFilePath(folder));
};

function getMiscXML(resourceElements) {
	var miscXMLContent = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<project version="4">',
		'<component name="ProjectResources">'
	];

	miscXMLContent = miscXMLContent.concat(resourceElements);

	miscXMLContent.push('</component>');

	var buildPropertiesContent = fs.readFileSync('build.properties');

	var languageLevel = '1.8';
	var languageLevelRegex = /javac.source=([0-9\.]*)/g;
	var matchResult = languageLevelRegex.exec(buildPropertiesContent);

	if (matchResult) {
		languageLevel = matchResult[1];
	}

	var languageLevelName = 'JDK_' + languageLevel.replace('.', '_');

	var projectRootManager = '<component name="ProjectRootManager" version="2" languageLevel="' +
		languageLevelName + '" default="false" assert-keyword="true" jdk-15="true" ' +
			'project-jdk-name="1.8" project-jdk-type="JavaSDK" />';

	miscXMLContent.push(projectRootManager);
	miscXMLContent.push('</project>');

	return {
		name: '.idea/misc.xml',
		content: miscXMLContent.join('\n')
	}
};

function getTagLibraryURIs(accumulator, tagLibraryPath) {
	var tagLibraryContent = fs.readFileSync(tagLibraryPath, {encoding: 'UTF8'});

	var pos1 = tagLibraryContent.indexOf('<uri>') + 5;
	var pos2 = tagLibraryContent.indexOf('</uri>', pos1);

	var tagLibraryURI = tagLibraryContent.substring(pos1, pos2);

	if (!accumulator.hasOwnProperty(tagLibraryURI) ||
		(tagLibraryPath.indexOf('portal-web') == 0)) {

		accumulator[tagLibraryURI] = tagLibraryPath;
	}

	return accumulator;
};

function getTagLibraryResourceElement(pair) {
	return '<resource url="' + pair[0] + '" location="$PROJECT_DIR$/' + pair[1] + '" />';
};

function getTagLibraryPaths(module) {
	var sourceFolders = module.sourceFolders
		.map(highland.flip(getFilePath, 'META-INF'));

	var resourceFolders = module.resourceFolders
		.map(highland.flip(getFilePath, 'META-INF'));

	var webrootFolders = module.webrootFolders
		.map(highland.flip(getFilePath, 'WEB-INF/tld'));

	var searchFolders = sourceFolders
		.concat(resourceFolders)
		.concat(webrootFolders)
		.map(getFilePath(module.modulePath))
		.filter(isDirectory);

	return searchFolders
		.map(getFilePaths)
		.reduce(flatten, [])
		.filter(isTagLibraryFile);
};

function isTagLibraryFile(fileName) {
	return fileName.indexOf('.tld') == fileName.length - 4;
};

exports.createProjectObjectModels = streams9.createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;