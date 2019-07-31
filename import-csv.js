const axios = require("axios");
const d3Dsv = require("d3-dsv");
const fs = require("fs");
const ProgressBar = require("progress");
const FormData = require("form-data");
const OMEKA_ENDPOINT = require("./omeka.config.js").OMEKA_ENDPOINT;
const OMEKA_API_KEY = require("./omeka.config.js").OMEKA_API_KEY;

const filesFolder = "./data/files/";
const items = d3Dsv.tsvParse(fs.readFileSync("./data/data.tsv", "utf-8"));

const bar = new ProgressBar("[:bar] :current/:total - :percent :eta", {
  total: items.length,
  width: 20
});

const params = {
  key: OMEKA_API_KEY
};

(async function() {
  const elements = await getElements(params);
  const item_types = await getItemTypes(params);

  for (const item of items) {
    const body = makeBody(item, elements, item_types);

    const responseItem = await uploadItem(body, params);
    const id = responseItem.id;
    const responseItemFiles = await uploadItemFiles(
      { item: { id: id } },
      item["files"].split("|"),
      params
    );
    bar.tick();
  }
})();

async function uploadItem(body, params) {
  try {
    const response = await axios.post(OMEKA_ENDPOINT + "/items", body, {
      params: { ...params }
    });

    return response.data;
  } catch (e) {
    console.log(e);
  }
}

async function uploadItemFiles(body, files, params) {
  try {
    const form = new FormData();

    form.append("data", JSON.stringify(body));

    files.forEach(f => {
      console.log(filesFolder + f);
      const fileStream = fs.createReadStream(filesFolder + f);
      form.append("file", fileStream, f);
    });

    const response = await axios.post(OMEKA_ENDPOINT + "/files", form, {
      params: { ...params },
      headers: form.getHeaders()
    });

    return response.data;
  } catch (e) {
    console.log(e);
  }
}

function makeBody(item, elements, item_types) {
  const body = {
    item_type: {
      id: getItemTypeId(item_types, item.item_type)
    },
    featured: false,
    public: false,
    collection: {
      id: item.collection ? item.collection : null
    },
    element_texts: []
  };

  for (const key in item) {
    if (
      key !== "item_type" &&
      key !== "files" &&
      key !== "tags" &&
      key !== "collection"
    ) {
      const element_set_id = +key.split("|")[0];
      const element_name = key.split("|")[1];

      body.element_texts.push({
        text: item[key],
        element_set: {
          id: element_set_id
        },
        html: false,
        element: {
          id: getElementId(elements, element_name, element_set_id)
        }
      });
    }
  }

  return body;
}

function getElementId(elements, element_name, element_set_id) {
  const element = elements.filter(d => {
    return d.name === element_name && d.element_set.id === element_set_id;
  });

  return element.length ? element[0].id : null;
}

function getItemTypeId(item_types, item_name) {
  const item_type = item_types.filter(d => {
    return d.name === item_name;
  });

  return item_type.length ? item_type[0].id : null;
}

async function getItemTypes(params) {
  try {
    const response = await axios.get(OMEKA_ENDPOINT + "/item_types", {
      params: { ...params }
    });
    return response.data;
  } catch (e) {
    console.log(e);
  }
}

async function getElements(params) {
  try {
    const response = await axios.get(OMEKA_ENDPOINT + "/elements", {
      params: { ...params }
    });
    return response.data;
  } catch (e) {
    console.log(e);
  }
}
