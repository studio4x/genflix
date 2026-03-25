const json = `[
  {
    "title": "Módulo 2"
  }
]`;

const regex = /\n(?!"\s*[}\],:])/g;
const cleaned = json.replace(regex, '\\n');

console.log("Original:\n" + json);
console.log("Cleaned:\n" + cleaned);

try {
  JSON.parse(cleaned);
  console.log("VALID");
} catch (e) {
  console.log("INVALID: " + e.message);
}
