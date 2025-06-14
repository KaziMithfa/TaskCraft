import React from "react";
import Carousel from "../components/Carousel";
import TabCategories from "../components/TabCategories";
import { useLoaderData } from "react-router-dom";

const Home = () => {
  //console.log(jobs);

  return (
    <div>
      <Carousel></Carousel>
      <TabCategories></TabCategories>
    </div>
  );
};

export default Home;
