/**
 * Retold Remote -- Browser Bundle Entry
 *
 * Exports the RetoldRemote application class for browser consumption.
 */
module.exports =
{
	RetoldRemoteApplication: require('./Pict-Application-RetoldRemote.js')
};

if (typeof (window) !== 'undefined')
{
	window.RetoldRemoteApplication = module.exports.RetoldRemoteApplication;
}
