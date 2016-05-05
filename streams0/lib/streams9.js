var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('./streams2');
var streams5 = require('./streams5');
var streams6 = require('./streams6');
var streams7 = require('./streams7');
var streams8 = require('./streams8');
var xmlbuilder = require('xmlbuilder');

var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getGradleLibraryPaths = streams8.getGradleLibraryPaths;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryOrderEntryElement = streams8.getLibraryOrderEntryElement;
var getLibraryRootElement = streams8.getLibraryRootElement;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getModuleOrderEntryElement = streams7.getModuleOrderEntryElement;
var getPomDependencyPaths = streams8.getPomDependencyPaths;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isFile = streams2.isFile;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;

function createProjectObjectModels(moduleDetails) {
	var moduleVersions = moduleDetails.reduce(setModuleBundleVersions, {});
	moduleDetails = moduleDetails.map(highland.partial(updateProjectDependencies, moduleVersions));

	var moduleStream = highland(moduleDetails);

	var mavenProjectStream = moduleStream.observe();
	var mavenAggregatorStream = moduleStream.observe();

	mavenProjectStream
		.map(getMavenProject)
		.each(saveContent);

	mavenAggregatorStream
		.pluck('modulePath')
		.collect()
		.map(getMavenAggregator)
		.each(saveContent);

	moduleStream.done(function() {});
};

function createProjectWorkspace(coreDetails, moduleDetails, pluginDetails) {
	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails = moduleDetails.map(highland.partial(updateProjectDependencies, moduleVersions));

	var moduleStream = highland(moduleDetails);
	var coreStream = highland(coreDetails);
	var pluginStream = highland(pluginDetails);

	var detailsStream = highland.merge([moduleStream, coreStream, pluginStream]);

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

	detailsStream.done(function() {});
};

function getJarLibraryTableXML(library) {
	var libraryTableXML = [
		'<library name="' + library.name + '">',
		'<CLASSES>',
		'<root url="file://$PROJECT_DIR$/lib/' + library.name + '" />',
		'</CLASSES>',
		'<JAVADOC />',
		'<SOURCES />',
		'<jarDirectory url="file://$PROJECT_DIR$/lib/' + library.name + '" recursive="false" />',
		'</library>'
	];

	return libraryTableXML.join('\n');
};

function getJarLibraryXML(library) {
	var fileName = library.name + '.xml';

	var libraryTableComponent = {
		name: 'libraryTable',
		content: getJarLibraryTableXML(library)
	};

	return {
		name: '.idea/libraries/' + fileName,
		content: getComponentXML(libraryTableComponent)
	};
};

function getLibraryPaths(library) {
	var mavenLibraryPaths = getMavenLibraryPaths(library);

	if (mavenLibraryPaths.length != 0) {
		return mavenLibraryPaths;
	}

	var gradleLibraryPaths = getGradleLibraryPaths(library);

	if (gradleLibraryPaths.length != 0) {
		return gradleLibraryPaths;
	}

	return [];
};

function getLibraryTableXML(library) {
	var libraryTableXML = [];

	libraryTableXML.push('<library name="' + library['libraryName'] + '" type="repository">');
	libraryTableXML.push('<properties maven-id="' + library['libraryName'] + '" />');

	var binaryPaths = getLibraryPaths(library);

	if (binaryPaths.length > 0) {
		libraryTableXML.push('<CLASSES>');
		Array.prototype.push.apply(libraryTableXML, binaryPaths.map(getLibraryRootElement));
		libraryTableXML.push('</CLASSES>');
	}
	else {
		libraryTableXML.push('<CLASSES />');
	}

	libraryTableXML.push('<JAVADOC />');

	var sourcePaths = binaryPaths.map(getMavenSourcePath).filter(isFile);

	if (sourcePaths.length > 0) {
		libraryTableXML.push('<SOURCES>');
		Array.prototype.push.apply(libraryTableXML, sourcePaths.map(getLibraryRootElement));
		libraryTableXML.push('</SOURCES>');
	}
	else {
		libraryTableXML.push('<SOURCES />');
	}

	libraryTableXML.push('</library>');

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

function getMavenAggregator(modulePaths) {
	var project = {
		project: {
			'@xmlns': 'http://maven.apache.org/POM/4.0.0',
			'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
			modelVersion: '4.0.0',
			groupId: 'com.liferay.dummy',
			artifactId: 'parent',
			version: '1.0.0-SNAPSHOT',
			packaging: 'pom',
			modules: {
				module: modulePaths
			}
		}
	};

	return {
		name: 'pom.xml',
		content: xmlbuilder.create(project).end({pretty: true})
	};
};

function getMavenDependencyElement(library) {
	return {
		'groupId': library.group,
		'artifactId': library.name,
		'version': library.version
	};
};

function getMavenLibraryPaths(library) {
	if (!('group' in library)) {
		return [];
	}

	var jarFileName = library.name + '-' + library.version + '.jar';

	var userHome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

	var jarRelativePath = library.group.split('.').concat([library.name, library.version, jarFileName]).join('/');
	var jarAbsolutePath = ['.m2', 'repository', jarRelativePath].reduce(getFilePath, userHome);

	if (isFile(jarAbsolutePath)) {
		return [jarAbsolutePath];
	}

	var pomFileName = library.name + '-' + library.version + '.pom';

	var pomRelativePath = library.group.split('.').concat([library.name, library.version, pomFileName]).join('/');
	var pomAbsolutePath = ['.m2', 'repository', pomRelativePath].reduce(getFilePath, userHome);

	if (!isFile(pomAbsolutePath)) {
		return [];
	}

	return getPomDependencyPaths(pomAbsolutePath, library.version);
};

function getMavenProject(module) {
	var dependencyObjects = {};

	if (module.libraryDependencies) {
		var libraryDependencies = module.libraryDependencies
			.filter(keyExistsInObject('group'))

		if (libraryDependencies.length > 0) {
			dependencyObjects = {
				dependency: libraryDependencies.map(getMavenDependencyElement)
			};
		}
	}

	var project = {
		project: {
			'@xmlns': 'http://maven.apache.org/POM/4.0.0',
			'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
			modelVersion: '4.0.0',
			groupId: 'com.liferay.dummy',
			artifactId: module.moduleName,
			version: '1.0.0-SNAPSHOT',
			packaging: 'pom',
			dependencies: dependencyObjects,
			repositories: {
				repository: [
					{
						id: 'default',
						name: 'Apache',
						url: 'http://repo.maven.apache.org/maven2',
						layout: 'default'
					},
					{
						id: 'liferay',
						name: 'Liferay',
						url: 'http://repository.liferay.com/nexus/content/repositories/public',
						layout: 'default'
					}
				]
			}
		}
	};

	return {
		name: getFilePath(module.modulePath, 'pom.xml'),
		content: xmlbuilder.create(project).end({pretty: true})
	};
};

function getMavenSourcePath(mavenBinaryPath) {
	var pos = mavenBinaryPath.lastIndexOf('.');

	return mavenBinaryPath.substring(0, pos) + '-sources' + mavenBinaryPath.substring(pos);
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
			.filter(keyExistsInObject('group'))
			.map(setLibraryName)
			.map(getLibraryOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(libraryOrderEntryElements);

		var coreLibraryOrderEntryElements = module.libraryDependencies
			.filter(highland.compose(highland.not, keyExistsInObject('group')))
			.map(setLibraryName)
			.map(getLibraryOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(coreLibraryOrderEntryElements);
	}

	if (module.projectDependencies) {
		var projectOrderEntryElements = module.projectDependencies
			.map(getModuleOrderEntryElement);

		newModuleRootManagerXML = newModuleRootManagerXML.concat(projectOrderEntryElements);
	}

	return newModuleRootManagerXML.join('\n');
};

function isMatchingProjectVersion(version1, version2) {
	if ((version1 == 'default') || (version2 == 'default')) {
		return true;
	}

	var pos1 = version1.indexOf(',');
	var pos2 = version2.indexOf(',');

	if ((pos1 != -1) || (pos2 != -1)) {
		return version1 == version2;
	}

	pos1 = version1.indexOf('.');
	pos2 = version2.indexOf('.');

	if ((pos1 == -1) || (pos2 == -1)) {
		return version1 == version2;
	}

	return version1.substring(0, pos1) === version2.substring(0, pos2);
};

function setCoreBundleVersions(accumulator, module) {
	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');
	var buildXmlPath = getFilePath(module.modulePath, 'build.xml');

	if (!isFile(bndPath)) {
		return accumulator;
	}

	var bndContent = fs.readFileSync(bndPath);
	var buildXmlContent = fs.readFileSync(buildXmlPath);

	var bundleNameRegex = /property name="manifest.bundle.symbolic.name" value="([^"\;]*)/g;
	var bundleVersionRegex = /Bundle-Version: ([^\n]+)/g;

	var bundleName = bundleNameRegex.exec(buildXmlContent)[1];
	var bundleVersion = bundleVersionRegex.exec(bndContent)[1];

	accumulator[bundleName] = {
		projectName: module.moduleName,
		version: bundleVersion
	};

	return accumulator;
};

function setModuleBundleVersions(accumulator, module) {
	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');
	var bndContent = fs.readFileSync(bndPath);

	var bundleNameRegex = /Bundle-SymbolicName: ([^\n]+)/g;
	var bundleVersionRegex = /Bundle-Version: ([^\n]+)/g;

	var bundleName = bundleNameRegex.exec(bndContent)[1];
	var bundleVersion = bundleVersionRegex.exec(bndContent)[1];

	accumulator[bundleName] = {
		projectName: module.moduleName,
		version: bundleVersion
	};

	return accumulator;
};

function updateProjectDependencies(moduleVersions, module) {
	if (!('libraryDependencies' in module)) {
		return module;
	}

	for (var i = module.libraryDependencies.length - 1; i >= 0; i--) {
		var dependency = module.libraryDependencies[i];
		var dependencyName = dependency.name;

		if (!(dependencyName in moduleVersions)) {
			continue;
		}

		if (dependencyName.indexOf('taglib') != -1) {
			continue;
		}

		var dependencyVersion = dependency.version;
		var moduleVersion = moduleVersions[dependencyName];

		if (!isMatchingProjectVersion(dependencyVersion, moduleVersion.version)) {
			console.warn(
				module.moduleName + ' depends on ' + dependencyName + ' version ' +
					dependencyVersion + ' (current version is ' + moduleVersion.version + ')');

			continue;
		}

		module.libraryDependencies.splice(i, 1);

		var projectDependency = {
			type: 'project',
			name: moduleVersion.projectName
		};

		module.projectDependencies.push(projectDependency);
	}

	return module;
};

exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;