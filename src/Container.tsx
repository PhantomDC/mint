import React, { FC } from 'react';
import './Container.css';
import h1 from './h1.svg';
import h2 from './h2.svg';
import monkey from './monkey.png';

interface IContainerProps {
	limit: number | null;
}

export const Container: FC<IContainerProps> = ({ children, limit }) => {
	return (
		<div className="container">
			<img src={h1} alt="h1" />
			<div className="mintContainer">
				<img src={monkey} alt="monkey" className="monkey" />
				{limit !== null && <div className="mintLimit"> {limit} TEEN APES FOR MINT</div>}
				{children}
			</div>
			<img src={h2} alt="h2" />
		</div>
	);
};
