const fetch = require('node-fetch');
const fs = require('fs').promises;

let wpPages = 1;
let wpPagesTotal = 1;
let customPostTypesRoute = [];

let url = `https://www.kuhar.ba/wp-json/wp/v2/posts?per_page=5`;
let recepies_url = `https://www.kuhar.ba/wp-json/wp/v2/recipes?per_page=5`;
let settings = {
  method: "Get"
};
const defaultPostTypes = ['page', 'post', 'attachment', 'wp_block', 'revision'];
const postTypesRoute = `https://www.kuhar.ba/wp-json/wp/v2/types`;

fetch(url, settings)
  .then(res => {
    if (res) {
      fetchPrepare(res);
    }
    return res;
  });

fetch(recepies_url, settings)
  .then(res => {
    if (res) {
      fetchRecepiesPrepare(res);
    }
    return res;
  });

const fetchPrepare = async (res, customType = 'posts') => {
  let array = Array.from({ length: res.headers.get('x-wp-totalpages')}, (_, k) => k)
  .filter(x=>x!=0);
  console.log(array.length + '=' + customType);
  let detail = "";

   asyncForEach(array, async(data, index, array) => {
     index == 0? index++: index;
     detailUrl = `https://www.kuhar.ba/wp-json/wp/v2/${customType}?per_page=5&page=${index}`;
     await fetchPostsPerPage(index, detailUrl,customType).then((data) => {
        return new Promise((resolve)=> setTimeout(resolve, 1000));
       }).then(()=>{console.log('next' + index);});
  });
};

const fetchRecepiesPrepare = async (res, customType = 'recipes') => {
  let array = Array.from({ length: res.headers.get('x-wp-totalpages')}, (_, k) => k)
  .filter(x=>x!=0);
  console.log(array.length + '=' + customType);
  let detail = "";

   asyncForEach(array, async(data, index, array) => {
     index == 0? index++: index;
     detailUrl = `https://www.kuhar.ba/wp-json/wp/v2/${customType}?per_page=5&page=${index}`;
     await fetchPostsPerPage(index, detailUrl,customType).then((data) => {
        return new Promise((resolve)=> setTimeout(resolve, 1000));
       }).then(()=>{console.log('next page = ' + index);});
  });
};

const fetchPostInfoDetaily = (url, id, parent) => {
  if (url === 'author') {
    url = 'users';
  }
  else if (url === 'featured_media') {
    url = 'media';
  }
 let detailInfoUrl = `https://www.kuhar.ba/wp-json/wp/v2/${url}/${id}`;
 let key = 'name';
 let detail = '';
 key = url!=='media'? 'name': 'source_url';
 
 return fetch(detailInfoUrl, settings)
 .then(res=>res.json())
 .then(json => {
   //Get key name of object or whole object
  if (parent) {
    return json;
  }
  else {
    return json[key];
  }
 });
};

const fetchCategoryParents = async (currentCategory,categories) => {
  let dataTemp = {};
  if (!categories.includes(currentCategory.name)) {
    categories.push({
      name: currentCategory.name,
      slug: currentCategory.slug
    });
  }
  if (currentCategory.parent > 0) {
     await fetchPostInfoDetaily('categories', currentCategory.parent, 'yes')
    .then(async(data) => {
      dataTemp = data;
      if (!categories.includes(data.name)) {
        categories.push({
          name: data.name,
          slug: data.slug
        });
      }
      if (dataTemp.parent > 0) {
        return fetchCategoryParents(dataTemp, categories);
      } else {
        return Promise.resolve(categories);
      }
    });
  }
  return Promise.resolve(categories);
};

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

const fetchPostsPerPage = async (page, url, controller) => {
  let resultPagination = 0;
  if (page > 20) {
    resultPagination = Math.floor(page / 20);
  }
  return fetch(url, settings)
    .then(res => res.json())
    .then(async (json) => {
      let approvedProperties = ['id','date','date_gmt','slug','status','type','link','title',
    'content','excerpt', 'author','featured_media','categories','tags','recipe_difficulty',
    'recipe_meal_course', 'recipe_serving', 'recipe_cooking_time', 'recipe_preparation_time', 'recipe_instructions',
    'recipe_ingredients', 'recipe_categories'];

    await asyncForEach(json, async item => {
      let detailInfo = '';
      for (let key in item) {
        if (!approvedProperties.includes(key)) {
          delete item[key];
        }
        if (key == 'content' || key == 'excerpt' || key == 'title') {
          let rendered = item[key].rendered;
          delete item[key].rendered;
          item[key] = rendered;
        }
        else if (key == 'author' || key == 'featured_media') {
           await fetchPostInfoDetaily(key, item[key])
          .then(data=> {
            item[key] = data;
          })
        }
        else if (key == 'categories') {
          await fetchPostInfoDetaily(key, item[key], 'yes')
          .then(async data=> {
            let categories = await fetchCategoryParents(data, new Array())
            .then((categoriesWithParent) => {
               item[key] = categoriesWithParent;
              });
          });
        }
      }
     });
      let jsonToBeFixed = JSON.stringify(json);
      jsonToBeFixed = jsonToBeFixed.replace('][', ',');
      await fs.appendFile(`${controller}_result_${resultPagination}.json`, jsonToBeFixed);
      return Promise.resolve();
    });
};
