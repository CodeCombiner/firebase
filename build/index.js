
var path = require('path'),
  fs = Promise.promisifyAll(require('fs-extra')),
  xmldoc = require('xmldoc'),
  xcodeUtil = require('../../devkit-core/modules/native-ios/lib/xcodeUtil'),
  copyFile = Promise.promisify(fs.copy);

exports.onCreateProject = function (api, app, config, cb) {
  var firebase = app.manifest.addons.firebase || {},
    app_path = app.paths.root,
    xcodeProjectPath = config.xcodeProjectPath,
    androidProjectPath = config.outputPath,
    plist_file = 'GoogleService-Info.plist',
    strings_file = 'firebase_strings.xml',
    addPlist = function () {
      return xcodeUtil.getXcodeProject(xcodeProjectPath)
        .then(function (xcodeProject) {
	  xcodeProject._project.addResourceFile(plist_file, null, 'CustomTemplate');

          return xcodeProject.write();
        });
    },
    addStrings = function () {
    },
    srcFile, destFile, googleConf, clientConfig, projectInfo;

  if (config.target == 'native-ios' && firebase.ios) {
    srcFile = path.join(app_path, firebase.ios);
    destFile = path.join(xcodeProjectPath, plist_file);

    return Promise
      .resolve()
      .then(function () {
        return copyFile(srcFile, destFile);
      })
      .then(addPlist)
      .then(cb);
  } else if (config.target == 'native-android' && firebase.android) {
    srcFile = path.join(app_path, firebase.android);
    googleConf = require(srcFile);
    clientConfig = googleConf.client[0];
    projectInfo = googleConf.project_info;
    googleConf = {
      default_web_client_id: clientConfig.oauth_client[0].client_id,
      firebase_database_url: projectInfo.firebase_url,
      gcm_defaultSenderId: projectInfo.project_number,
      google_api_key: clientConfig.api_key[0].current_key,
      google_app_id: clientConfig.client_info.mobilesdk_app_id,
      google_crash_reporting_api_key: clientConfig.api_key[0].current_key,
      google_storage_bucket: projectInfo.storage_bucket
    };
    xmlStr = new xmldoc.XmlDocument(fs.readFileSync(path.join(__dirname, '../android/strings.xml'), 'utf-8'));

    for (var i = 0; i < xmlStr.children.length; i++) {
      var currStrDom = xmlStr.children[i],
        attrName = currStrDom.attr.name;

      if (currStrDom.name === 'string' && attrName in googleConf) {
        console.log(attrName, googleConf[attrName]);
        currStrDom.val = googleConf[attrName];
      }
    }

    return fs.outputFileAsync(path.join(androidProjectPath, 'res/values', strings_file), xmlStr.toString(), 'utf-8');
  }

  return Promise.resolve(true);
}
