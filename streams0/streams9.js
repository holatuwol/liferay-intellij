var child_process = require('child_process');
var comparators = require('comparators').default;
var fs = require('fs');
var highland = require('highland');
var streams2 = require('../streams2/streams2');
var streams5 = require('../streams6/streams5');
var streams6 = require('../streams7/streams6');
var streams7 = require('../streams8/streams7');
var streams8 = require('../streams9/streams8');
var xmlbuilder = require('xmlbuilder');

var checkForGradleCache = streams8.checkForGradleCache;
var checkForMavenCache = streams8.checkForMavenCache;
var generateFileListCache = streams8.generateFileListCache;
var getAncestorFiles = streams7.getAncestorFiles;
var getComponentXML = streams6.getComponentXML;
var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getFilePath = streams5.getFilePath;
var getIntellijXML = streams6.getIntellijXML;
var getLibraryJarPaths = streams8.getLibraryJarPaths;
var getLibraryOrderEntryElement = streams8.getLibraryOrderEntryElement;
var getLibraryRootElement = streams8.getLibraryRootElement;
var getModuleElement = streams7.getModuleElement;
var getModulesElement = streams7.getModulesElement;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getSourceFolderElement = streams6.getSourceFolderElement;
var getUserHome = streams8.getUserHome;
var getWorkspaceModulesXML = streams7.getWorkspaceModulesXML;
var isDirectory = streams2.isDirectory;
var isFile = streams2.isFile;
var isFirstOccurrence = streams8.isFirstOccurrence;
var isJar = streams8.isJar;
var isSameLibraryDependency = streams8.isSameLibraryDependency;
var keyExistsInObject = highland.ncurry(2, streams8.keyExistsInObject);
var saveContent = streams6.saveContent;
var setLibraryName = streams8.setLibraryName;

var gradleCaches = streams8.gradleCaches;
var mavenCaches = streams8.mavenCaches;

var projectRepositories = [];

function createProjectObjectModels(coreDetails, moduleDetails) {
	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, false));

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
	moduleDetails.forEach(checkForGradleCache);
	checkForGradleCache(getUserHome());
	checkForGradleCache('../liferay-binaries-cache-2020');
	checkForGradleCache('../liferay-binaries-cache-2017');

	for (gradleCache of gradleCaches) {
		generateFileListCache(gradleCache);
	}

	checkForMavenCache(getUserHome());

	for (mavenCache of mavenCaches) {
		generateFileListCache(mavenCache);
	}

	if (pluginDetails) {
		pluginDetails.forEach(sortModuleAttributes);
	}

	var moduleVersions = coreDetails.reduce(setCoreBundleVersions, {});
	moduleVersions = moduleDetails.reduce(setModuleBundleVersions, moduleVersions);

	moduleDetails.forEach(highland.partial(fixLibraryDependencies, moduleVersions));
	moduleDetails.forEach(highland.partial(fixProjectDependencies, moduleVersions, true));
	moduleDetails.forEach(highland.partial(checkExportDependencies, moduleVersions));

	coreDetails.forEach(sortModuleAttributes);
	moduleDetails.forEach(sortModuleAttributes);

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

	detailsStream.done(function() {});
};

function addTestLibraryDependency(module, dependencyName) {
	var isLibraryIncluded = function(dependency) {
		return dependency.name == dependencyName;
	};

	module.libraryDependencies = module.libraryDependencies || [];

	if (module.libraryDependencies.some(isLibraryIncluded)) {
		return;
	}

	var dependency = {
		type: 'library',
		name: dependencyName,
		libraryName: dependencyName,
		testScope: true
	};

	module.libraryDependencies.push(dependency);
};

function checkExportDependencies(moduleVersions, module) {
	var isTestModule = (module.modulePath.indexOf('test') != -1);

	if (isTestModule) {
		addTestLibraryDependency(module, 'development');

		if (module.testSourceFolders.indexOf('src/testIntegration/java') != -1) {
			addTestLibraryDependency(module, 'global');
			addTestLibraryDependency(module, 'portal');
		}
	}

	if (module.moduleName.indexOf('gradle-') == 0) {
		var libraryDependency = {
			type: 'library',
			name: 'gradlew',
			libraryName: 'gradlew'
		};

		module.libraryDependencies.push(libraryDependency);
	}

	var isThirdPartyModule = (module.modulePath.indexOf('sdk') != -1) ||
		((module.modulePath.indexOf('core') != -1) && (module.moduleName.indexOf('osgi') != -1)) ||
		(module.modulePath.indexOf('third-party') != -1) ||
		((module.sourceFolders.length == 0) && (module.testSourceFolders.length == 0));

	var checkExportDependency = function(dependency) {
		if (isTestModule || isThirdPartyModule || (getDependencyGroup(moduleVersions, dependency) == 'com.liferay')) {
			dependency.exported = true;
		}
	};

	if ('libraryDependencies' in module) {
		module.libraryDependencies.forEach(checkExportDependency);
	}

	if ('projectDependencies' in module) {
		module.projectDependencies.forEach(checkExportDependency);
	}
};

function fixLibraryDependencies(moduleVersions, module) {
	if (!('libraryDependencies' in module)) {
		module.libraryDependencies = [];
	}

	var ownVersion = moduleVersions[module.moduleName];

	for (var i = module.libraryDependencies.length - 1; i >= 0; i--) {
		var dependency = module.libraryDependencies[i];
		var dependencyGroup = dependency.group;

		if (!dependencyGroup || (dependencyGroup.indexOf('com.liferay') != 0)) {
			continue;
		}

		var dependencyName = dependency.name;

		if (!(dependencyName in moduleVersions)) {
			continue;
		}

		var moduleVersion = moduleVersions[dependencyName];

		if (module.hasInitJsp && moduleVersion.hasInitJsp) {
			dependency.hasInitJsp = true;
			continue;
		}

		module.libraryDependencies.splice(i, 1);

		var projectDependency = {
			type: 'project',
			name: moduleVersion.projectName,
			testScope: dependency.testScope
		};

		module.projectDependencies.push(projectDependency);
	}

	return module;
};

function fixProjectDependencies(moduleVersions, addAsLibrary, module) {
	if (!('projectDependencies' in module)) {
		return module;
	}

	if (!module.hasInitJsp) {
		return module;
	}

	for (var i = module.projectDependencies.length - 1; i >= 0; i--) {
		var dependency = module.projectDependencies[i];
		var dependencyName = dependency.name;

		if (!(dependencyName in moduleVersions)) {
			continue;
		}

		if (!addAsLibrary) {
			module.projectDependencies.splice(i, 1);
			continue;
		}

		var moduleVersion = moduleVersions[dependencyName];

		if (!moduleVersion.hasInitJsp) {
			continue;
		}

		module.projectDependencies.splice(i, 1);

		var libraryDependency = {
			type: 'library',
			group: 'com.liferay',
			name: moduleVersion.bundleName,
			version: dependency.version || moduleVersion.version,
			testScope: dependency.testScope,
			hasInitJsp: true
		};

		var jarPaths = getLibraryJarPaths(libraryDependency);

		if (jarPaths.length > 0) {
			module.libraryDependencies.push(libraryDependency);
		}
	}

	return module;
};

function getCoreLibraryOrderEntryElements(module) {
	if (!module.libraryDependencies) {
		return [];
	}

	return module.libraryDependencies
		.filter(highland.compose(highland.not, keyExistsInObject('group')))
		.map(setLibraryName)
		.map(highland.partial(getLibraryOrderEntryElement, module));
};

function getDependencyGroup(moduleVersions, dependency) {
	if (dependency.type == 'library') {
		return dependency.group;
	}

	var moduleVersion = moduleVersions[dependency.name];

	if (moduleVersion) {
		return moduleVersion.bundleGroup || moduleVersion.projectGroup;
	}

	return null;
};

function getGradleLibraryJars() {
	var folders = ['.gradle/wrapper/dists'];
	var gradleLibraryJars = [];

	while (folders.length > 0) {
		var folder = folders.splice(0, 1)[0];
		var subfiles = fs.readdirSync(folder).map(getFilePath(folder));

		Array.prototype.push.apply(
			folders,
			subfiles.filter(isDirectory));

		Array.prototype.push.apply(
			gradleLibraryJars,
			subfiles.filter(isJar));
	}

	return gradleLibraryJars.filter(highland.compose(highland.not, isKotlinJar));
};

function getJarLibraryTableXML(library) {
	var libraryTableXML = ['<library name="' + library.name + '" type="repository">'];

	if (library.name.indexOf(':') != -1) {
		libraryTableXML.push('<properties maven-id="' + library.name + '" />');
	};

	libraryTableXML.push('<CLASSES>');

	if (library.name == 'development') {
		var libraryPath = getFilePath('lib', 'development');
		var jarFiles = fs.readdirSync(libraryPath);

		Array.prototype.push.apply(
			libraryTableXML,
			jarFiles.filter(isDevelopmentLibrary)
				.map(highland.partial(getFilePath, libraryPath))
				.map(getLibraryRootElement));

		if (isFile('lib/portal/bnd.jar')) {
			libraryTableXML.push(getLibraryRootElement('lib/portal/bnd.jar'));
		}
	}
	else if (library.name == 'gradlew') {
		var jarFiles = getGradleLibraryJars();

		Array.prototype.push.apply(
			libraryTableXML,
			jarFiles.map(getLibraryRootElement));
	}
	else {
		libraryTableXML.push(
			'<root url="file://$PROJECT_DIR$/lib/' + library.name + '" />');
	}

	libraryTableXML.push(
		'</CLASSES>',
		'<JAVADOC />',
		'<SOURCES />');

	if ((library.name != 'development') && (library.name != 'gradlew')) {
		libraryTableXML.push('<jarDirectory url="file://$PROJECT_DIR$/lib/' + library.name + '" recursive="false" />');
	}

	libraryTableXML.push('</library>');

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

function getLatestCommitDate(remoteName, branchName) {
	try {
		return child_process.execSync('git log -1 --pretty="%ci" ' + remoteName + '/' + branchName).toString().trim();
	}
	catch (e) {
		return '1970-01-01 00:00:00 -0000';
	}
};

function getLibraryTableXML(library) {
	var libraryTableXML = [];

	libraryTableXML.push('<library name="' + library['libraryName'] + '">');
	libraryTableXML.push('<properties />');

	var binaryPaths = getLibraryJarPaths(library);
	var binaryPathsSet = new Set(binaryPaths);

	binaryPaths = [];
	binaryPathsSet.forEach(highland.ncurry(1, Array.prototype.push.bind(binaryPaths)));

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
			groupId: 'com.liferay.dependencies',
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
	var dependencyElement = {
		'groupId': library.group,
		'artifactId': library.name,
		'version': library.version
	};

	if (isKnownPomDependency(library)) {
		dependencyElement['type'] = 'pom';
	}

	var exclusions = null;

	if ((library.group == 'easyconf') && (library.name == 'easyconf') && (library.version == '0.9.5')) {
		exclusions = ['xdoclet:xdoclet', 'xdoclet:xdoclet-web-module', 'xpp3:xpp3_min'];
	}

	if ((library.group == 'net.open-esb.core') && (library.name == 'jbi_rt') && (library.version == '2.4.3')) {
		exclusions = ['glassfish:appserv-ext'];
	}

	if ((library.group == 'org.eclipse.platform') && (library.name == 'org.eclipse.equinox.console')) {
		exclusions = ['org.apache.felix:org.apache.felix.gogo.runtime'];
	}

	if (exclusions != null) {
		dependencyElement['exclusions'] = {
			'exclusion': exclusions.map(getMavenExclusion)
		};
	}

	return dependencyElement;
};

function getMavenExclusion(exclusion) {
	var pos = exclusion.indexOf(':');

	return {
		'groupId': exclusion.substring(0, pos),
		'artifactId': exclusion.substring(pos + 1)
	};
}

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

	return {
		name: getFilePath(module.modulePath, 'pom.xml'),
		content: getMavenProjectXML(module.bundleSymbolicName, module.bundleVersion, dependencyObjects)
	}
};

function getMavenProjectXML(bundleSymbolicName, bundleVersion, dependencyObjects) {
	var project = {
		project: {
			'@xmlns': 'http://maven.apache.org/POM/4.0.0',
			'@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
			'@xsi:schemaLocation': 'http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd',
			modelVersion: '4.0.0',
			groupId: 'com.liferay',
			artifactId: bundleSymbolicName,
			version: bundleVersion,
			packaging: 'pom',
			dependencies: dependencyObjects,
			repositories: {
				repository: getProjectRepositories().map(getProjectRepositoriesXMLEntry)
			}
		}
	};

	return xmlbuilder.create(project).end({pretty: true})
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
	var newModuleRootManagerXML = [streams6.getNewModuleRootManagerXML(module)];

	newModuleRootManagerXML = newModuleRootManagerXML.concat(streams8.getModuleLibraryOrderEntryElements(module));
	newModuleRootManagerXML = newModuleRootManagerXML.concat(streams7.getProjectOrderEntryElements(module));
	newModuleRootManagerXML = newModuleRootManagerXML.concat(getCoreLibraryOrderEntryElements(module));

	return newModuleRootManagerXML.join('\n');
};

var liferayPrivateRepository = null;

function getLiferayPrivateRepository() {
	if (liferayPrivateRepository != null) {
		if (liferayPrivateRepository.id) {
			return liferayPrivateRepository;
		}

		return null;
	}

	var propertiesContent = null;

	if (fs.existsSync('working.dir.properties')) {
		propertiesContent = fs.readFileSync('working.dir.properties').toString();
	}
	else {
		var privateRemoteName = child_process.execSync('git remote -v | grep -F "liferay/liferay-portal-ee" | cut -f 1 | head -1').toString().trim();

		if (privateRemoteName) {
			var privateBranchNames = ['7.0.x-private', '7.1.x-private', '7.2.x-private', 'master-private'];
			var privateBranchDates = privateBranchNames.map(getLatestCommitDate.bind(null, privateRemoteName));
			var privateBranchIndex = 0;

			for (var i = 1; i < privateBranchNames.length; i++) {
				if (privateBranchDates[i] > privateBranchDates[privateBranchIndex]) {
					privateBranchIndex = i;
				}
			}

			var passwordBranchName = privateBranchNames[privateBranchIndex];
			var passwordBranchDate = privateBranchDates[privateBranchIndex];
			passwordBranchDate = passwordBranchDate.substring(0, passwordBranchDate.indexOf(' '));

			console.log('[' + new Date().toLocaleTimeString() + ']', 'Checking', privateRemoteName + '/' + passwordBranchName, '(last fetched ' + passwordBranchDate + ') for Liferay private Maven repository metadata');

			try {
				propertiesContent = child_process.execSync('git show ' + privateRemoteName + '/' + passwordBranchName + ':working.dir.properties');
			}
			catch (e) {
				console.error(e);
			}

			if (!propertiesContent) {
				try {
					propertiesContent = child_process.execSync('git show ' + passwordBranchName + ':working.dir.properties');
				}
				catch (e) {
					console.error(e);
				}
			}
		}
	}

	if (propertiesContent == null) {
		liferayPrivateRepository = {};

		return null;
	}

	var repositoryMetadata = getRepositoryMetadata(propertiesContent);

	if (repositoryMetadata == null) {
		return null;
	}

	var repositoryPath = repositoryMetadata['url'];

	if (repositoryPath.indexOf('https://') == 0) {
		repositoryPath = repositoryPath.substring(8);
	}

	liferayPrivateRepository = {
		id: 'liferay-private',
		name: 'Liferay Private',
		scheme: 'https',
		username: repositoryMetadata['username'],
		password: repositoryMetadata['password'],
		path: repositoryPath,
		layout: 'default'
	};

	return liferayPrivateRepository;
}

function getProjectRepositories() {
	if (projectRepositories.length > 0) {
		return projectRepositories;
	}

	var tempProjectRepositories = [];

	tempProjectRepositories.push({
		id: 'apache',
		name: 'Apache',
		scheme: 'https',
		path: 'repo.maven.apache.org/maven2',
		layout: 'default'
	});

	tempProjectRepositories.push({
		id: 'liferay-public',
		name: 'Liferay Public',
		scheme: 'https',
		path: 'repository-cdn.liferay.com/nexus/content/repositories/public',
		layout: 'default'
	});

	tempProjectRepositories.push({
		id: 'jaspersoft-third-party',
		name: 'Jaspersoft Third-Party',
		scheme: 'http',
		path: 'jaspersoft.jfrog.io/jaspersoft/third-party-ce-artifacts',
		layout: 'default'
	});

	if (isDirectory('.git') || isFile('.git')) {
		var privateRepository = getLiferayPrivateRepository();

		if (privateRepository != null) {
			tempProjectRepositories.push(privateRepository);
		}
	}

	projectRepositories = tempProjectRepositories;

	return projectRepositories;
};

function getProjectRepositoriesXMLEntry(repository) {
	var repositoryBasicAuth = '';

	if (repository.username) {
		repositoryBasicAuth = encodeURIComponent(repository.username) + ':' + encodeURIComponent(repository.password) + '@';
	}

	var repositoryURL = repository.scheme + '://' + repositoryBasicAuth + repository.path;

	return {
		id: repository.id,
		name: repository.name,
		url: repositoryURL,
		layout: repository.layout
	};
};

function getRepositoryMetadata(propertiesContent) {
	var keyPrefix = 'build.repository.private.';

	return propertiesContent.toString()
		.split('\n')
		.map(function(x) {
			return x.trim();
		})
		.filter(function(x) {
			return (x.indexOf(keyPrefix) == 0) && (x.indexOf('[') == -1);
		})
		.reduce(function(accumulator, next) {
			accumulator = accumulator || {};

			var entry = next.split('=');
			var key = entry[0].trim();

			key = key.substring(keyPrefix.length);

			accumulator[key] = entry[1].trim();
			return accumulator;
		}, null);
}

function isDevelopmentLibrary(libraryName) {
	return libraryName.indexOf('.jar') == libraryName.length - 4;
};

var knownPomDependencies = new Set();
knownPomDependencies.add('org.apache.axis2:axis2');
knownPomDependencies.add('org.apache.directory.api:apache-ldap-api');
knownPomDependencies.add('org.jboss.shrinkwrap:shrinkwrap-depchain');

function isKnownPomDependency(library) {
	return knownPomDependencies.has(library.group + ':' + library.name);
};

function isKotlinJar(jarPath) {
	return jarPath.indexOf('kotlin') != -1;
};

function setCoreBundleVersions(accumulator, module) {
	var bndPath = getFilePath(module.modulePath, 'bnd.bnd');
	var buildXmlPath = getFilePath(module.modulePath, 'build.xml');

	if (!isFile(bndPath)) {
		return accumulator;
	}

	var bndContent = fs.readFileSync(bndPath);

	var bundleNameRegex = /property name="manifest.bundle.symbolic.name" value="([^"\;]*)/g;
	var bundleVersionRegex = /Bundle-Version: ([^\r\n]+)/g;

	var bundleName = 'com.liferay.' + module.moduleName.replace(/-/g, '.');
	var matchResult = null;

	if (isFile(buildXmlPath)) {
		var buildXmlContent = fs.readFileSync(buildXmlPath);

		matchResult = bundleNameRegex.exec(buildXmlContent);

		if (!matchResult) {
			return accumulator;
		}

		bundleName = matchResult[1];
	}

	matchResult = bundleVersionRegex.exec(bndContent);

	if (!matchResult) {
		return accumulator;
	}

	var bundleVersion = matchResult[1];

	accumulator[bundleName] = {
		projectGroup: 'com.liferay.portal',
		projectName: module.moduleName,
		version: bundleVersion,
		hasInitJsp: (module.moduleName == 'portal-web')
	};

	accumulator[module.moduleName] = {
		bundleGroup: 'com.liferay.portal',
		bundleName: bundleName,
		version: bundleVersion,
		hasInitJsp: (module.moduleName == 'portal-web')
	};

	return accumulator;
};

function setModuleBundleVersions(accumulator, module) {
	var hasInitJsp = module.webrootFolders
		.map(getFilePath.bind(null, module.modulePath))
		.map(highland.flip(getFilePath, 'init.jsp'))
		.filter(isFile).length > 0;

	module.hasInitJsp = hasInitJsp;

	accumulator[module.bundleSymbolicName] = {
		projectGroup: 'com.liferay',
		projectName: module.moduleName,
		version: module.bundleVersion,
		hasInitJsp: hasInitJsp
	};

	accumulator[module.moduleName] = {
		bundleGroup: 'com.liferay',
		bundleName: module.bundleSymbolicName,
		version: module.bundleVersion,
		hasInitJsp: hasInitJsp
	};

	return accumulator;
};

function sortModuleAttributes(module) {
	module.sourceFolders.sort();
	module.resourceFolders.sort();
	module.testSourceFolders.sort();
	module.testResourceFolders.sort();

	if (module.libraryDependencies) {
		module.libraryDependencies.sort(comparators.comparing('name'));
	}

	if (module.projectDependencies) {
		module.projectDependencies.sort(comparators.comparing('name'));
	}

	return module;
};

exports.checkExportDependencies = checkExportDependencies;
exports.createProjectObjectModels = createProjectObjectModels;
exports.createProjectWorkspace = createProjectWorkspace;
exports.fixLibraryDependencies = fixLibraryDependencies;
exports.fixProjectDependencies = fixProjectDependencies;

exports.gradleCaches = gradleCaches;
exports.getJarLibraryXML = getJarLibraryXML;
exports.getLibraryXML = getLibraryXML;
exports.getLiferayPrivateRepository = getLiferayPrivateRepository;
exports.getMavenAggregator = getMavenAggregator;
exports.getMavenDependencyElement = getMavenDependencyElement;
exports.getMavenProject = getMavenProject;
exports.getMavenProjectXML = getMavenProjectXML;
exports.getModuleXML = getModuleXML;
exports.mavenCaches = mavenCaches;
exports.getProjectRepositories = getProjectRepositories;
exports.setCoreBundleVersions = setCoreBundleVersions;
exports.setModuleBundleVersions = setModuleBundleVersions;
exports.sortModuleAttributes = sortModuleAttributes;