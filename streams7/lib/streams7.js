var highland = require('highland');
var streams6 = require('./streams6');

var getExcludeFolderElement = streams6.getExcludeFolderElement;
var getFacetManagerXML = streams6.getFacetManagerXML;
var getModuleIMLPath = streams6.getModuleIMLPath;
var getIntellijXML = streams6.getIntellijXML;
var getSourceFolderElement = streams6.getSourceFolderElement;
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

	detailsStream.done(function() {});
};

function getAncestorFiles(folder, filename) {
	var ancestorFiles = [];

	var basename = '';

	while ((basename != '.') && (basename != '..')) {
		var filePath = getFilePath(folder, filename);

		if (isFile(filePath)) {
			ancestorFiles.push(filePath);
		}

		folder = path.dirname(folder);
		basename = path.basename(folder);
	}

	return ancestorFiles;
};

function getModuleGroupName(module) {
	if (module.type == 'portal') {
		return 'portal';
	}

	if (module.type == 'plugins-sdk') {
		var pluginSDKRoot = path.normalize(getFilePath(module.modulePath, '../../..'));

		return module.modulePath.substring(pluginSDKRoot.length + 1);
	}

	var groupPrefix = '';
	var modulesRoot = '';

	var gradlePropertiesPaths = getAncestorFiles(module.modulePath, 'gradle.properties');

	for (var i = 0; i < gradlePropertiesPaths.length; i++) {
		var gradlePropertiesContent = fs.readFileSync(gradlePropertiesPaths[i]);

		var projectPrefixRegex = /project.path.prefix=:(.*)/g;
		var matchResult = projectPrefixRegex.exec(gradlePropertiesContent);

		if (matchResult) {
			groupPrefix = 'modules/' + matchResult[1].split(':').join('/');
			modulesRoot = path.dirname(gradlePropertiesPaths[0]);

			break;
		}
	}

	if (groupPrefix == '') {
		modulesRoot = path.dirname(path.dirname(gradlePropertiesPaths[0]));
	}

	var relativeGroupName = path.dirname(module.modulePath);

	if ((modulesRoot != '') && (modulesRoot != '.')) {
		relativeGroupName = path.dirname(module.modulePath.substring(modulesRoot.length + 1));
	}

	if (groupPrefix == '') {
		return relativeGroupName;
	}
	else if (relativeGroupName == '.') {
		return groupPrefix;
	}
	else {
		return groupPrefix + '/' + relativeGroupName;
	}
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

	if (module.projectDependencies) {
		// TODO: Perform work on module.projectDependencies here
	}

	return newModuleRootManagerXML.join('\n');
};

exports.createProjectWorkspace = createProjectWorkspace;