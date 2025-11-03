/* eslint-disable strict */
//var request = require('request');

const translatorApi = module.exports;

translatorApi.translate = async function (postData) {
	//  Edit the translator URL below
	try {
		const TRANSLATOR_API = 'TODO';
		const response = await fetch(TRANSLATOR_API + '/?content=' + postData.content);
		const data = await response.json();
		return [data['is_english'],data['translated_content']];
	} catch(err) {
		// By default, return that the post is in English,
		// and don't translate post content.
		return [true, postData.content];
	}
};