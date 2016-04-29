var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');

var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
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
		.sortBy(comparators.comparing('modulePath'))
		.map(getModuleElement)
		.collect()
		.map(getModulesElement)
		.map(getWorkspaceModulesXML)
		.map(getIntellijXML)
		.each(saveContent);

	libraryFilesStream
		.pluck('libraryDependencies')
		.compact()
		.flatten()
		.uniqBy(isSameLibraryDependency)
		.doto(setGradleJarPath)
		.filter(highland.partial(keyExistsInObject, 'gradleJarPath'))
		.doto(setLibraryName)
		.map(getLibraryXML)
		.each(saveContent);

	detailsStream.done(function() {});
};

function getLibraryOrderEntryElement(libraryDependency) {
	return '<orderEntry type="library" name="' + libraryDependency['libraryName'] + '" level="project"/>';
};

function getLibraryTableXML(library) {
	var libraryTableXML = [
		'<library name="' + library['libraryName'] + '">',
		'<CLASSES>',
		'<root url="jar://$PROJECT_DIR$/' + library['gradleJarPath'] + '!/" />',
		'</CLASSES>',
		'<JAVADOC />',
		'<SOURCES />',
		'</library>'
	];

	return libraryTableXML.join('\n');
};

function getLibraryXML(library) {
	var fileName = library['libraryName'].replace(/\W/g, '_') + '.xml';

	var libraryTableComponent = {
		name: 'libraryTable',
		content: getLibraryTableXML(library)
	};

	return {
		name: '.idea/libraries/' + fileName,
		content: getComponentXML(libraryTableComponent)
	};
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
	var newModuleRootManagerXML = ['<content url="file://$MODULE_DIR$">'];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(
		module.sourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'false')),
		module.resourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-resource')),
		module.testSourceFolders.map(highland.partial(getSourceFolderElement, 'isTestSource', 'true')),
		module.testResourceFolders.map(highland.partial(getSourceFolderElement, 'type', 'java-test-resource')),
		module.excludeFolders.map(getExcludeFolderElement)
	);

	newModuleRootManagerXML.push('</content>');
	newModuleRootManagerXML.push('<orderEntry type="inheritedJdk" />');
	newModuleRootManagerXML.push('<orderEntry type="sourceFolder" forTests="false" />');

	if (module.libraryDependencies) {
		var libraryOrderEntryElements = module.libraryDependencies
			.map(setGradleJarPath)
			.filter(highland.partial(keyExistsInObject, 'gradleJarPath'))
			.map(setLibraryName)
			.map(getLibraryOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(libraryOrderEntryElements);
	}

	if (module.projectDependencies) {
		var projectOrderEntryElements = module.projectDependencies
			.map(getModuleOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(projectOrderEntryElements);
	}

	return newModuleRootManagerXML.join('\n');
};

function isSameLibraryDependency(left, right) {
	return (left.group == right.group) &&
		(left.name == right.name) &&
		(left.version == right.version);
};

function keyExistsInObject(key, object) {
	return object && key in object;
};

function setGradleJarPath(library) {
	var gradleBasePath = '.gradle/caches/modules-2/files-2.1';
	var folderPath = [library.group, library.name, library.version].reduce(getFilePath, gradleBasePath);

	if (!isDirectory(folderPath)) {
		return null;
	}

	var libraryFileName = library.name + '-' + library.version + '.jar';

	var gradleJarPaths = fs.readdirSync(folderPath)
		.map(getFilePath(folderPath))
		.map(highland.flip(getFilePath, libraryFileName))
		.filter(isFile);

	if (gradleJarPaths.length > 0) {
		library['gradleJarPath'] = gradleJarPaths[0];
	}

	return library;
};

function setLibraryName(library) {
	if (keyExistsInObject('group', library)) {
		library['libraryName'] = library.group + ':' + library.name + ':' + library.version;
	}
	else {
		library['libraryName'] = library.name;
	}

	return library;
};

exports.createProjectWorkspace = createProjectWorkspace;
exports.getLibraryOrderEntryElement = getLibraryOrderEntryElement;
exports.getLibraryXML = getLibraryXML;
exports.getModuleXML = getModuleXML;
exports.isSameLibraryDependency = isSameLibraryDependency;
exports.keyExistsInObject = keyExistsInObject;
exports.setGradleJarPath = setGradleJarPath;
exports.setLibraryName = setLibraryName;