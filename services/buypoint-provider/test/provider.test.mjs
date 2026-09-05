import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveProduct } from '../src/index.js';

const ORIGIN = 'https://private-buypoint.example';

function request(body, origin = ORIGIN) {
  return new Request('https://provider.example/api/buypoint/resolve', {
    method: 'POST',
    headers: {'content-type':'application/json','origin':origin},
    body: JSON.stringify(body),
  });
}

test('fails closed when the provider secret is absent', async () => {
  const response = await resolveProduct(request({input:{type:'text',value:'Bartenura 750 mL'}}), {BUYPOINT_ALLOWED_ORIGIN:ORIGIN});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {error:'provider_not_configured'});
});

test('rejects an unapproved browser origin', async () => {
  const response = await resolveProduct(
    request({input:{type:'text',value:'Bartenura 750 mL'}}, 'https://outside.example'),
    {BUYPOINT_ALLOWED_ORIGIN:ORIGIN, BUYPOINT_OPENAI_API_KEY:'test'},
  );
  assert.equal(response.status, 403);
});

test('photo input requires an actual supported image data URL', async () => {
  const response = await resolveProduct(
    request({input:{type:'photo',image_data_url:'not-an-image'}}),
    {BUYPOINT_ALLOWED_ORIGIN:ORIGIN, BUYPOINT_OPENAI_API_KEY:'test'},
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error:'photo_required'});
});

test('builds an official Responses API web-search and vision request', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = {url, options, body:JSON.parse(options.body)};
    return new Response(JSON.stringify({
      output:[
        {type:'web_search_call',action:{sources:[{url:'https://retailer.example/item'}]}},
        {type:'message',content:[{type:'output_text',text:JSON.stringify({
          status:'matched',
          product:{name:'Example',brand:'Brand',variant:'750 mL',quantity_value:750,quantity_unit:'mL',gtin:''},
          offers:[{retailer:'Retailer',price:10.5,currency:'USD',package_quantity:'750 mL',unit_price:1.4,shipping:'pickup',coupon:'none evidenced',availability:'in stock',source_url:'https://retailer.example/item',observed_at:'2026-09-04',confidence:'high'}],
          recommended_buy_price:10,
          guidance:'WATCH',
          reason:'Current offer is above the evidence-based target.',
          back_in_stock_supported:false,
          limitations:[],
        })}]},
      ],
    }), {status:200,headers:{'content-type':'application/json'}});
  };
  const response = await resolveProduct(
    request({input:{type:'photo',value:'blue bottle',image_data_url:'data:image/jpeg;base64,AA=='}}),
    {BUYPOINT_ALLOWED_ORIGIN:ORIGIN, BUYPOINT_OPENAI_API_KEY:'test', BUYPOINT_MODEL:'gpt-6-astra'},
    fetchImpl,
  );
  assert.equal(response.status, 200);
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.deepEqual(captured.body.tools, [{type:'web_search'}]);
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(captured.body.text.format.strict, true);
  assert.equal(captured.body.input[0].content[1].type, 'input_image');
  assert.match(captured.body.input[0].content[0].text, /Never invent/);
});

test('rejects matched offers that are not backed by returned web sources', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output:[
      {type:'web_search_call',action:{sources:[{url:'https://different.example/item'}]}},
      {type:'message',content:[{type:'output_text',text:JSON.stringify({
        status:'matched',product:{name:'Example',brand:'',variant:'',quantity_value:null,quantity_unit:'',gtin:''},
        offers:[{retailer:'Unknown',price:9,currency:'USD',package_quantity:'',unit_price:null,shipping:'',coupon:'',availability:'',source_url:'https://unsupported.example/item',observed_at:'',confidence:'low'}],
        recommended_buy_price:null,guidance:'WATCH',reason:'Insufficient evidence.',back_in_stock_supported:false,limitations:[],
      })}]},
    ],
  }), {status:200,headers:{'content-type':'application/json'}});
  const response = await resolveProduct(
    request({input:{type:'text',value:'example'}}),
    {BUYPOINT_ALLOWED_ORIGIN:ORIGIN, BUYPOINT_OPENAI_API_KEY:'test'},
    fetchImpl,
  );
  assert.equal(response.status, 422);
});
