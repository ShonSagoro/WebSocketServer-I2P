const preferences = {};

preferences[1] = {
    username: "JUAN",
    id: 1
};
preferences[2] = {
    username: "AS",
    id: 2
};
preferences[3] = {
    username: "SD",
    id: 3
};
const name= "JU"
const isExist=Object.values(preferences).filter((x)=> x.username.includes(name));

console.log(isExist[0].username)   
if(isExist[0].username==name){
    console.log("wacho, no cambie")
    console.log(isExist)   
}else{
    console.log("Cambie, andele, nadie lo usa")
}
