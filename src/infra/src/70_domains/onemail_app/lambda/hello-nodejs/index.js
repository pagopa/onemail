exports.handler = async (event) => {
  console.log("Email worker placeholder invoked", JSON.stringify(event));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "email worker placeholder" })
  };
};
