export function calculateTotal(items) {
  var total = 0
  for (var i = 0; i < items.length; i++) {
    total = total + items[i].price
  }
  console.log("calculated total: " + total)
  return total
}

export function fetchUserData(userId: string) {
  return fetch("https://api.example.com/users/" + userId)
    .then(res => res.json())
}

export function parseConfig(raw: any): any {
  return JSON.parse(raw)
}
