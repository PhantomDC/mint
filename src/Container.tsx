import React, { FC } from 'react';
import './Container.css';
import h1 from './h1.svg';
import h2 from './h2.svg';

interface IContainerProps {
	limit: number;
}

export const Container: FC<IContainerProps> = ({ children, limit }) => {
	return (
		<div className="container">
			<img src={h1} alt="h1" />
			<div className="mintContainer">
				<div className="mintLimit"> {limit} TEEN APES FOR MINT</div>
				{children}
			</div>
			<img src={h2} alt="h2" />
		</div>
	);
};
